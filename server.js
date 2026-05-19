/*
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// =============================================
// FUNCIÓN HELPER PARA FORMATEAR FECHAS
// =============================================
function formatearFecha(fecha) {
    if (!fecha) return null;
    // Si la fecha tiene 'T' (formato ISO), extraer solo YYYY-MM-DD
    if (fecha.includes('T')) {
        return fecha.split('T')[0];
    }
    return fecha;
}

// =============================================
// CONFIGURACIÓN DE BASE DE DATOS
// =============================================
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Mercedes_1365',
    database: process.env.DB_NAME || 'cine_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const JWT_SECRET = process.env.JWT_SECRET || 'mi_super_secreto_jwt_2024_cine_app';

// =============================================
// MIDDLEWARES
// =============================================
const verificarToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token requerido.' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
};

const verificarAdmin = (req, res, next) => {
    if (req.usuario.rol !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Permisos de administrador requeridos.' });
    }
    next();
};

// =============================================
// ENDPOINT PARA CREAR/ACTUALIZAR USUARIOS DE PRUEBA
// =============================================
app.get('/api/crear-usuarios', async (req, res) => {
    try {
        const hash = await bcrypt.hash('123456', 10);
        
        const [adminExiste] = await pool.query('SELECT id FROM usuarios WHERE email = ?', ['admin@cine.com']);
        
        if (adminExiste.length === 0) {
            await pool.query(
                'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
                ['Administrador', 'admin@cine.com', hash, 'admin']
            );
        } else {
            await pool.query(
                'UPDATE usuarios SET password = ?, rol = ? WHERE email = ?',
                [hash, 'admin', 'admin@cine.com']
            );
        }
        
        const [clienteExiste] = await pool.query('SELECT id FROM usuarios WHERE email = ?', ['cliente@test.com']);
        
        if (clienteExiste.length === 0) {
            await pool.query(
                'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
                ['Cliente Test', 'cliente@test.com', hash, 'cliente']
            );
        } else {
            await pool.query(
                'UPDATE usuarios SET password = ?, rol = ? WHERE email = ?',
                [hash, 'cliente', 'cliente@test.com']
            );
        }
        
        res.json({ 
            success: true,
            message: 'Usuarios actualizados exitosamente',
            usuarios: [
                { email: 'admin@cine.com', password: '123456', rol: 'admin' },
                { email: 'cliente@test.com', password: '123456', rol: 'cliente' }
            ]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// RUTA DE PRUEBA
// =============================================
app.get('/', (req, res) => {
    res.json({ 
        message: 'API de CineApp funcionando correctamente',
        endpoints: {
            crear_usuarios: '/api/crear-usuarios (GET)',
            login: '/api/auth/login (POST)',
            register: '/api/auth/register (POST)',
            peliculas: '/api/peliculas (GET)',
            buscar_peliculas: '/api/peliculas/buscar?q=termino (GET)',
            productos: '/api/productos (GET)',
            buscar_productos: '/api/productos/buscar?q=termino (GET)'
        }
    });
});

// =============================================
// RUTAS DE AUTENTICACIÓN
// =============================================

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const [usuarios] = await pool.query(
            'SELECT id, nombre, email, password, rol FROM usuarios WHERE email = ?',
            [email]
        );
        
        if (usuarios.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }
        
        const usuario = usuarios[0];
        const passwordValida = await bcrypt.compare(password, usuario.password);
        
        if (!passwordValida) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }
        
        const token = jwt.sign(
            { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor.' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    const { nombre, email, password } = req.body;
    
    try {
        const [existe] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existe.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado.' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
            [nombre, email, hashedPassword, 'cliente']
        );
        
        res.status(201).json({ message: 'Usuario registrado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor.' });
    }
});

// =============================================
// RUTAS DE PELÍCULAS
// =============================================

// Obtener todas las películas
app.get('/api/peliculas', async (req, res) => {
    try {
        const [peliculas] = await pool.query(
            'SELECT * FROM peliculas WHERE estado != "finalizada" ORDER BY fecha_estreno DESC'
        );
        res.json(peliculas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener películas.' });
    }
});

// BUSCAR PELÍCULAS por título, género o descripción
app.get('/api/peliculas/buscar', async (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.json([]);
    }
    
    try {
        const [peliculas] = await pool.query(
            `SELECT * FROM peliculas 
             WHERE estado != "finalizada" 
             AND (titulo LIKE ? OR genero LIKE ? OR descripcion LIKE ?)
             ORDER BY fecha_estreno DESC`,
            [`%${q}%`, `%${q}%`, `%${q}%`]
        );
        res.json(peliculas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al buscar películas.' });
    }
});

// Obtener una película por ID
app.get('/api/peliculas/:id', async (req, res) => {
    try {
        const [peliculas] = await pool.query(
            'SELECT * FROM peliculas WHERE id = ?',
            [req.params.id]
        );
        
        if (peliculas.length === 0) {
            return res.status(404).json({ error: 'Película no encontrada.' });
        }
        
        res.json(peliculas[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener película.' });
    }
});

// Crear película (solo admin)
app.post('/api/peliculas', verificarToken, verificarAdmin, async (req, res) => {
    const { titulo, descripcion, duracion, genero, imagen_url, fecha_estreno } = req.body;
    
    try {
        const [result] = await pool.query(
            'INSERT INTO peliculas (titulo, descripcion, duracion, genero, imagen_url, fecha_estreno) VALUES (?, ?, ?, ?, ?, ?)',
            [titulo, descripcion, duracion, genero, imagen_url, formatearFecha(fecha_estreno)]
        );
        
        res.status(201).json({ id: result.insertId, message: 'Película creada exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear película.' });
    }
});

// Actualizar película (solo admin)
app.put('/api/peliculas/:id', verificarToken, verificarAdmin, async (req, res) => {
    const { titulo, descripcion, duracion, genero, imagen_url, fecha_estreno } = req.body;
    
    try {
        await pool.query(
            'UPDATE peliculas SET titulo = ?, descripcion = ?, duracion = ?, genero = ?, imagen_url = ?, fecha_estreno = ? WHERE id = ?',
            [titulo, descripcion, duracion, genero, imagen_url, formatearFecha(fecha_estreno), req.params.id]
        );
        
        res.json({ message: 'Película actualizada exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar película.' });
    }
});

// Eliminar película (solo admin)
app.delete('/api/peliculas/:id', verificarToken, verificarAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM peliculas WHERE id = ?', [req.params.id]);
        res.json({ message: 'Película eliminada exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar película.' });
    }
});

// =============================================
// RUTAS DE HORARIOS
// =============================================

// Obtener horarios de una película
app.get('/api/horarios/pelicula/:peliculaId', async (req, res) => {
    try {
        const [horarios] = await pool.query(
            `SELECT h.*, p.titulo as pelicula_titulo 
             FROM horarios h 
             JOIN peliculas p ON h.pelicula_id = p.id 
             WHERE h.pelicula_id = ? AND h.fecha >= CURDATE() 
             ORDER BY h.fecha, h.hora`,
            [req.params.peliculaId]
        );
        res.json(horarios);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener horarios.' });
    }
});

// Obtener todos los horarios (solo admin)
app.get('/api/horarios', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const [horarios] = await pool.query(
            `SELECT h.*, p.titulo as pelicula_titulo 
             FROM horarios h 
             JOIN peliculas p ON h.pelicula_id = p.id 
             ORDER BY h.fecha DESC, h.hora`
        );
        res.json(horarios);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener horarios.' });
    }
});

// Crear horario (solo admin)
app.post('/api/horarios', verificarToken, verificarAdmin, async (req, res) => {
    const { pelicula_id, sala, fecha, hora, precio } = req.body;
    
    try {
        const [result] = await pool.query(
            'INSERT INTO horarios (pelicula_id, sala, fecha, hora, precio) VALUES (?, ?, ?, ?, ?)',
            [pelicula_id, sala, formatearFecha(fecha), hora, precio]
        );
        
        res.status(201).json({ id: result.insertId, message: 'Horario creado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear horario.' });
    }
});

// Eliminar horario (solo admin)
app.delete('/api/horarios/:id', verificarToken, verificarAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM horarios WHERE id = ?', [req.params.id]);
        res.json({ message: 'Horario eliminado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar horario.' });
    }
});

// =============================================
// RUTAS DE ASIENTOS
// =============================================

// Obtener asientos de un horario
app.get('/api/asientos/horario/:horarioId', async (req, res) => {
    try {
        const [asientos] = await pool.query(
            'SELECT * FROM asientos WHERE horario_id = ? ORDER BY fila, numero',
            [req.params.horarioId]
        );
        res.json(asientos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener asientos.' });
    }
});

// =============================================
// RUTAS DE RESERVAS DE CINE
// =============================================

// Crear reserva
app.post('/api/reservas/cine', verificarToken, async (req, res) => {
    const { horario_id, asiento_id, total } = req.body;
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const [asiento] = await connection.query(
            'SELECT estado FROM asientos WHERE id = ? FOR UPDATE',
            [asiento_id]
        );
        
        if (asiento[0].estado === 'ocupado') {
            await connection.rollback();
            return res.status(400).json({ error: 'El asiento ya está ocupado.' });
        }
        
        const codigo_reserva = 'CINE-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        
        await connection.query(
            'INSERT INTO reservas_cine (usuario_id, horario_id, asiento_id, codigo_reserva, total) VALUES (?, ?, ?, ?, ?)',
            [req.usuario.id, horario_id, asiento_id, codigo_reserva, total]
        );
        
        await connection.query(
            'UPDATE asientos SET estado = "ocupado" WHERE id = ?',
            [asiento_id]
        );
        
        await connection.commit();
        
        res.status(201).json({ codigo_reserva, message: 'Reserva creada exitosamente.' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Error al crear reserva.' });
    } finally {
        connection.release();
    }
});

// Obtener reserva por código
app.get('/api/reservas/codigo/:codigo', verificarToken, async (req, res) => {
    try {
        const [reservas] = await pool.query(
            `SELECT r.*, p.titulo as pelicula, h.sala, h.fecha, h.hora, a.fila, a.numero as asiento_numero
             FROM reservas_cine r
             JOIN horarios h ON r.horario_id = h.id
             JOIN peliculas p ON h.pelicula_id = p.id
             JOIN asientos a ON r.asiento_id = a.id
             WHERE r.codigo_reserva = ? AND r.usuario_id = ?`,
            [req.params.codigo, req.usuario.id]
        );
        
        if (reservas.length === 0) {
            return res.status(404).json({ error: 'Reserva no encontrada.' });
        }
        
        res.json(reservas[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener reserva.' });
    }
});

// Obtener mis reservas
app.get('/api/reservas/mis-reservas', verificarToken, async (req, res) => {
    try {
        const [reservas] = await pool.query(
            `SELECT r.*, p.titulo as pelicula, h.sala, h.fecha, h.hora, a.fila, a.numero as asiento_numero
             FROM reservas_cine r
             JOIN horarios h ON r.horario_id = h.id
             JOIN peliculas p ON h.pelicula_id = p.id
             JOIN asientos a ON r.asiento_id = a.id
             WHERE r.usuario_id = ?
             ORDER BY r.fecha_reserva DESC`,
            [req.usuario.id]
        );
        res.json(reservas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener reservas.' });
    }
});

// =============================================
// RUTAS DE PRODUCTOS (BAR)
// =============================================

// Obtener todos los productos
app.get('/api/productos', async (req, res) => {
    try {
        const [productos] = await pool.query(
            'SELECT * FROM productos WHERE stock > 0 ORDER BY categoria, nombre'
        );
        res.json(productos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener productos.' });
    }
});

// BUSCAR PRODUCTOS por nombre, descripción o categoría
app.get('/api/productos/buscar', async (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.json([]);
    }
    
    try {
        const [productos] = await pool.query(
            `SELECT * FROM productos 
             WHERE stock > 0 
             AND (nombre LIKE ? OR descripcion LIKE ? OR categoria LIKE ?)
             ORDER BY categoria, nombre`,
            [`%${q}%`, `%${q}%`, `%${q}%`]
        );
        res.json(productos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al buscar productos.' });
    }
});

// Crear producto (solo admin)
app.post('/api/productos', verificarToken, verificarAdmin, async (req, res) => {
    const { nombre, descripcion, precio, stock, categoria, imagen_url } = req.body;
    
    try {
        const [result] = await pool.query(
            'INSERT INTO productos (nombre, descripcion, precio, stock, categoria, imagen_url) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, descripcion, precio, stock, categoria, imagen_url]
        );
        
        res.status(201).json({ id: result.insertId, message: 'Producto creado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear producto.' });
    }
});

// Actualizar producto (solo admin)
app.put('/api/productos/:id', verificarToken, verificarAdmin, async (req, res) => {
    const { nombre, descripcion, precio, stock, categoria, imagen_url } = req.body;
    
    try {
        await pool.query(
            'UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ?, categoria = ?, imagen_url = ? WHERE id = ?',
            [nombre, descripcion, precio, stock, categoria, imagen_url, req.params.id]
        );
        
        res.json({ message: 'Producto actualizado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar producto.' });
    }
});

// Eliminar producto (solo admin)
app.delete('/api/productos/:id', verificarToken, verificarAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM productos WHERE id = ?', [req.params.id]);
        res.json({ message: 'Producto eliminado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar producto.' });
    }
});

// =============================================
// RUTAS DE PEDIDOS (BAR)
// =============================================

// Crear pedido
app.post('/api/pedidos/bar', verificarToken, async (req, res) => {
    const { productos, total } = req.body;
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Verificar stock
        for (const item of productos) {
            const [stockActual] = await connection.query(
                'SELECT stock FROM productos WHERE id = ? FOR UPDATE',
                [item.id]
            );
            
            if (stockActual[0].stock < item.cantidad) {
                await connection.rollback();
                return res.status(400).json({ error: 'Stock insuficiente para algunos productos.' });
            }
        }
        
        const codigo_pedido = 'BAR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        
        const [result] = await connection.query(
            'INSERT INTO pedidos_bar (usuario_id, codigo_pedido, total) VALUES (?, ?, ?)',
            [req.usuario.id, codigo_pedido, total]
        );
        
        for (const item of productos) {
            await connection.query(
                'INSERT INTO detalles_pedido (pedido_id, producto_id, cantidad, subtotal) VALUES (?, ?, ?, ?)',
                [result.insertId, item.id, item.cantidad, item.subtotal]
            );
            
            await connection.query(
                'UPDATE productos SET stock = stock - ? WHERE id = ?',
                [item.cantidad, item.id]
            );
        }
        
        await connection.commit();
        
        res.status(201).json({ codigo_pedido, message: 'Pedido creado exitosamente.' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Error al crear pedido.' });
    } finally {
        connection.release();
    }
});

// Obtener pedido por código
app.get('/api/pedidos/codigo/:codigo', verificarToken, async (req, res) => {
    try {
        const [pedidos] = await pool.query(
            `SELECT p.* 
             FROM pedidos_bar p
             WHERE p.codigo_pedido = ? AND p.usuario_id = ?`,
            [req.params.codigo, req.usuario.id]
        );
        
        if (pedidos.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado.' });
        }
        
        const [detalles] = await pool.query(
            `SELECT dp.*, pr.nombre, pr.precio
             FROM detalles_pedido dp
             JOIN productos pr ON dp.producto_id = pr.id
             WHERE dp.pedido_id = ?`,
            [pedidos[0].id]
        );
        
        res.json({ ...pedidos[0], detalles });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener pedido.' });
    }
});

// Obtener mis pedidos
app.get('/api/pedidos/mis-pedidos', verificarToken, async (req, res) => {
    try {
        const [pedidos] = await pool.query(
            `SELECT p.*, 
                    COUNT(dp.id) as total_productos,
                    SUM(dp.cantidad) as cantidad_total
             FROM pedidos_bar p
             LEFT JOIN detalles_pedido dp ON p.id = dp.pedido_id
             WHERE p.usuario_id = ?
             GROUP BY p.id
             ORDER BY p.fecha DESC`,
            [req.usuario.id]
        );
        res.json(pedidos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener pedidos.' });
    }
});

// =============================================
// RUTAS DE ESTADÍSTICAS (solo admin)
// =============================================

app.get('/api/admin/stats', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const [totalPeliculas] = await pool.query('SELECT COUNT(*) as total FROM peliculas');
        const [totalReservas] = await pool.query('SELECT COUNT(*) as total FROM reservas_cine');
        const [totalPedidos] = await pool.query('SELECT COUNT(*) as total FROM pedidos_bar');
        const [totalUsuarios] = await pool.query('SELECT COUNT(*) as total FROM usuarios');
        const [ingresosCine] = await pool.query('SELECT SUM(total) as total FROM reservas_cine');
        const [ingresosBar] = await pool.query('SELECT SUM(total) as total FROM pedidos_bar');
        
        res.json({
            peliculas: totalPeliculas[0].total,
            reservas: totalReservas[0].total,
            pedidos: totalPedidos[0].total,
            usuarios: totalUsuarios[0].total,
            ingresosCine: ingresosCine[0].total || 0,
            ingresosBar: ingresosBar[0].total || 0,
            ingresosTotales: (ingresosCine[0].total || 0) + (ingresosBar[0].total || 0)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener estadísticas.' });
    }
});

// =============================================
// RUTA PARA ACTUALIZAR PERFIL DE USUARIO
// =============================================

app.put('/api/usuarios/perfil', verificarToken, async (req, res) => {
    const { nombre, email, password } = req.body;
    
    try {
        // Verificar si el email ya está en uso por otro usuario
        if (email !== req.usuario.email) {
            const [existe] = await pool.query(
                'SELECT id FROM usuarios WHERE email = ? AND id != ?',
                [email, req.usuario.id]
            );
            if (existe.length > 0) {
                return res.status(400).json({ error: 'El email ya está registrado por otro usuario.' });
            }
        }
        
        let query = 'UPDATE usuarios SET nombre = ?, email = ?';
        const params = [nombre, email];
        
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += ', password = ?';
            params.push(hashedPassword);
        }
        
        query += ' WHERE id = ?';
        params.push(req.usuario.id);
        
        await pool.query(query, params);
        
        // Actualizar token con nuevos datos
        const nuevoToken = jwt.sign(
            { id: req.usuario.id, nombre, email, rol: req.usuario.rol },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({ 
            message: 'Perfil actualizado exitosamente',
            token: nuevoToken,
            usuario: { id: req.usuario.id, nombre, email, rol: req.usuario.rol }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar perfil.' });
    }
});

// =============================================
// RUTAS DE TARJETA
// =============================================

// Obtener tarjeta del usuario
app.get('/api/tarjeta', verificarToken, async (req, res) => {
    try {
        const [tarjeta] = await pool.query(
            'SELECT id, usuario_id, numero_tarjeta, saldo FROM tarjetas WHERE usuario_id = ?',
            [req.usuario.id]
        );
        
        if (tarjeta.length === 0) {
            return res.status(404).json({ error: 'No hay tarjeta registrada' });
        }
        
        res.json(tarjeta[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener tarjeta' });
    }
});

// Actualizar o crear tarjeta
app.put('/api/tarjeta', verificarToken, async (req, res) => {
    const { numero_tarjeta, saldo } = req.body;
    
    try {
        const [existe] = await pool.query(
            'SELECT id FROM tarjetas WHERE usuario_id = ?',
            [req.usuario.id]
        );
        
        if (existe.length === 0) {
            await pool.query(
                'INSERT INTO tarjetas (usuario_id, numero_tarjeta, saldo) VALUES (?, ?, ?)',
                [req.usuario.id, numero_tarjeta, saldo]
            );
        } else {
            await pool.query(
                'UPDATE tarjetas SET numero_tarjeta = ?, saldo = ? WHERE usuario_id = ?',
                [numero_tarjeta, saldo, req.usuario.id]
            );
        }
        
        res.json({ message: 'Tarjeta actualizada exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar tarjeta' });
    }
});

// Recargar saldo
app.post('/api/tarjeta/recargar', verificarToken, async (req, res) => {
    const { monto } = req.body;
    
    if (monto <= 0) {
        return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }
    
    try {
        await pool.query(
            'UPDATE tarjetas SET saldo = saldo + ? WHERE usuario_id = ?',
            [monto, req.usuario.id]
        );
        
        const [tarjeta] = await pool.query(
            'SELECT saldo FROM tarjetas WHERE usuario_id = ?',
            [req.usuario.id]
        );
        
        res.json({ message: 'Saldo recargado exitosamente', nuevo_saldo: tarjeta[0].saldo });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al recargar saldo' });
    }
});

// Procesar pago
app.post('/api/pagos/procesar', verificarToken, async (req, res) => {
    const { metodo, monto, numero_tarjeta } = req.body;
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        if (metodo === 'tarjeta') {
            const [tarjeta] = await connection.query(
                'SELECT saldo FROM tarjetas WHERE usuario_id = ?',
                [req.usuario.id]
            );
            
            if (tarjeta.length === 0) {
                throw new Error('No hay tarjeta registrada');
            }
            
            if (tarjeta[0].saldo < monto) {
                throw new Error('Saldo insuficiente');
            }
            
            await connection.query(
                'UPDATE tarjetas SET saldo = saldo - ? WHERE usuario_id = ?',
                [monto, req.usuario.id]
            );
        }
        
        await connection.commit();
        res.json({ success: true, message: 'Pago procesado exitosamente' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// =============================================
// INICIAR SERVIDOR
// =============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
*/

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// =============================================
// FUNCIÓN HELPER PARA FORMATEAR FECHAS
// =============================================
function formatearFecha(fecha) {
    if (!fecha) return null;
    // Si la fecha tiene 'T' (formato ISO), extraer solo YYYY-MM-DD
    if (fecha.includes('T')) {
        return fecha.split('T')[0];
    }
    return fecha;
}

// =============================================
// CONFIGURACIÓN DE BASE DE DATOS
// =============================================

// Detectar si estamos en producción (Render) o local
const isProduction = process.env.NODE_ENV === 'production';

// Configuración para producción (Aiven) o local (MySQL local)
let poolConfig;

if (isProduction) {
    // Configuración para Aiven en producción
    poolConfig = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT),
        ssl: {
            // ca: process.env.DB_CA_CERT
            rejectUnauthorized: false
        },
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
    };
} else {
    // Configuración para desarrollo local
    poolConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'Mercedes_1365',
        database: process.env.DB_NAME || 'cine_db',
        port: parseInt(process.env.DB_PORT) || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };
}

const pool = mysql.createPool(poolConfig);

// Probar conexión al iniciar
async function testDatabaseConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Base de datos conectada correctamente');
        connection.release();
    } catch (error) {
        console.error('❌ Error conectando a la base de datos:', error.message);
        if (isProduction) {
            console.error('Verifica las variables de entorno en Render');
        }
    }
}
testDatabaseConnection();

const JWT_SECRET = process.env.JWT_SECRET || 'mi_super_secreto_jwt_2024_cine_app';

// =============================================
// MIDDLEWARES
// =============================================
const verificarToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token requerido.' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
};

const verificarAdmin = (req, res, next) => {
    if (req.usuario.rol !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Permisos de administrador requeridos.' });
    }
    next();
};

// =============================================
// ENDPOINT PARA CREAR/ACTUALIZAR USUARIOS DE PRUEBA
// =============================================
app.get('/api/crear-usuarios', async (req, res) => {
    try {
        const hash = await bcrypt.hash('123456', 10);
        
        const [adminExiste] = await pool.query('SELECT id FROM usuarios WHERE email = ?', ['admin@cine.com']);
        
        if (adminExiste.length === 0) {
            await pool.query(
                'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
                ['Administrador', 'admin@cine.com', hash, 'admin']
            );
        } else {
            await pool.query(
                'UPDATE usuarios SET password = ?, rol = ? WHERE email = ?',
                [hash, 'admin', 'admin@cine.com']
            );
        }
        
        const [clienteExiste] = await pool.query('SELECT id FROM usuarios WHERE email = ?', ['cliente@test.com']);
        
        if (clienteExiste.length === 0) {
            await pool.query(
                'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
                ['Cliente Test', 'cliente@test.com', hash, 'cliente']
            );
        } else {
            await pool.query(
                'UPDATE usuarios SET password = ?, rol = ? WHERE email = ?',
                [hash, 'cliente', 'cliente@test.com']
            );
        }
        
        res.json({ 
            success: true,
            message: 'Usuarios actualizados exitosamente',
            usuarios: [
                { email: 'admin@cine.com', password: '123456', rol: 'admin' },
                { email: 'cliente@test.com', password: '123456', rol: 'cliente' }
            ]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// RUTA DE PRUEBA
// =============================================
app.get('/', (req, res) => {
    res.json({ 
        message: 'API de CineApp funcionando correctamente',
        environment: isProduction ? 'producción (Aiven MySQL)' : 'desarrollo (local)',
        endpoints: {
            crear_usuarios: '/api/crear-usuarios (GET)',
            login: '/api/auth/login (POST)',
            register: '/api/auth/register (POST)',
            peliculas: '/api/peliculas (GET)',
            buscar_peliculas: '/api/peliculas/buscar?q=termino (GET)',
            productos: '/api/productos (GET)',
            buscar_productos: '/api/productos/buscar?q=termino (GET)'
        }
    });
});

// =============================================
// RUTAS DE AUTENTICACIÓN
// =============================================

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const [usuarios] = await pool.query(
            'SELECT id, nombre, email, password, rol FROM usuarios WHERE email = ?',
            [email]
        );
        
        if (usuarios.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }
        
        const usuario = usuarios[0];
        const passwordValida = await bcrypt.compare(password, usuario.password);
        
        if (!passwordValida) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }
        
        const token = jwt.sign(
            { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor.' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    const { nombre, email, password } = req.body;
    
    try {
        const [existe] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existe.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado.' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
            [nombre, email, hashedPassword, 'cliente']
        );
        
        res.status(201).json({ message: 'Usuario registrado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor.' });
    }
});

// =============================================
// RUTAS DE PELÍCULAS
// =============================================

// Obtener todas las películas
app.get('/api/peliculas', async (req, res) => {
    try {
        const [peliculas] = await pool.query(
            'SELECT * FROM peliculas WHERE estado != "finalizada" ORDER BY fecha_estreno DESC'
        );
        res.json(peliculas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener películas.' });
    }
});

// BUSCAR PELÍCULAS por título, género o descripción
app.get('/api/peliculas/buscar', async (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.json([]);
    }
    
    try {
        const [peliculas] = await pool.query(
            `SELECT * FROM peliculas 
             WHERE estado != "finalizada" 
             AND (titulo LIKE ? OR genero LIKE ? OR descripcion LIKE ?)
             ORDER BY fecha_estreno DESC`,
            [`%${q}%`, `%${q}%`, `%${q}%`]
        );
        res.json(peliculas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al buscar películas.' });
    }
});

// Obtener una película por ID
app.get('/api/peliculas/:id', async (req, res) => {
    try {
        const [peliculas] = await pool.query(
            'SELECT * FROM peliculas WHERE id = ?',
            [req.params.id]
        );
        
        if (peliculas.length === 0) {
            return res.status(404).json({ error: 'Película no encontrada.' });
        }
        
        res.json(peliculas[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener película.' });
    }
});

// Crear película (solo admin)
app.post('/api/peliculas', verificarToken, verificarAdmin, async (req, res) => {
    const { titulo, descripcion, duracion, genero, imagen_url, fecha_estreno } = req.body;
    
    try {
        const [result] = await pool.query(
            'INSERT INTO peliculas (titulo, descripcion, duracion, genero, imagen_url, fecha_estreno) VALUES (?, ?, ?, ?, ?, ?)',
            [titulo, descripcion, duracion, genero, imagen_url, formatearFecha(fecha_estreno)]
        );
        
        res.status(201).json({ id: result.insertId, message: 'Película creada exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear película.' });
    }
});

// Actualizar película (solo admin)
app.put('/api/peliculas/:id', verificarToken, verificarAdmin, async (req, res) => {
    const { titulo, descripcion, duracion, genero, imagen_url, fecha_estreno } = req.body;
    
    try {
        await pool.query(
            'UPDATE peliculas SET titulo = ?, descripcion = ?, duracion = ?, genero = ?, imagen_url = ?, fecha_estreno = ? WHERE id = ?',
            [titulo, descripcion, duracion, genero, imagen_url, formatearFecha(fecha_estreno), req.params.id]
        );
        
        res.json({ message: 'Película actualizada exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar película.' });
    }
});

// Eliminar película (solo admin)
app.delete('/api/peliculas/:id', verificarToken, verificarAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM peliculas WHERE id = ?', [req.params.id]);
        res.json({ message: 'Película eliminada exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar película.' });
    }
});

// =============================================
// RUTAS DE HORARIOS
// =============================================

// Obtener horarios de una película
app.get('/api/horarios/pelicula/:peliculaId', async (req, res) => {
    try {
        const [horarios] = await pool.query(
            `SELECT h.*, p.titulo as pelicula_titulo 
             FROM horarios h 
             JOIN peliculas p ON h.pelicula_id = p.id 
             WHERE h.pelicula_id = ? AND h.fecha >= CURDATE() 
             ORDER BY h.fecha, h.hora`,
            [req.params.peliculaId]
        );
        res.json(horarios);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener horarios.' });
    }
});

// Obtener todos los horarios (solo admin)
app.get('/api/horarios', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const [horarios] = await pool.query(
            `SELECT h.*, p.titulo as pelicula_titulo 
             FROM horarios h 
             JOIN peliculas p ON h.pelicula_id = p.id 
             ORDER BY h.fecha DESC, h.hora`
        );
        res.json(horarios);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener horarios.' });
    }
});

// Crear horario (solo admin)
app.post('/api/horarios', verificarToken, verificarAdmin, async (req, res) => {
    const { pelicula_id, sala, fecha, hora, precio } = req.body;
    
    try {
        const [result] = await pool.query(
            'INSERT INTO horarios (pelicula_id, sala, fecha, hora, precio) VALUES (?, ?, ?, ?, ?)',
            [pelicula_id, sala, formatearFecha(fecha), hora, precio]
        );
        
        res.status(201).json({ id: result.insertId, message: 'Horario creado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear horario.' });
    }
});

// Eliminar horario (solo admin)
app.delete('/api/horarios/:id', verificarToken, verificarAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM horarios WHERE id = ?', [req.params.id]);
        res.json({ message: 'Horario eliminado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar horario.' });
    }
});

// =============================================
// RUTAS DE ASIENTOS
// =============================================

// Obtener asientos de un horario
app.get('/api/asientos/horario/:horarioId', async (req, res) => {
    try {
        const [asientos] = await pool.query(
            'SELECT * FROM asientos WHERE horario_id = ? ORDER BY fila, numero',
            [req.params.horarioId]
        );
        res.json(asientos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener asientos.' });
    }
});

// =============================================
// RUTAS DE RESERVAS DE CINE
// =============================================

// Crear reserva
app.post('/api/reservas/cine', verificarToken, async (req, res) => {
    const { horario_id, asiento_id, total } = req.body;
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const [asiento] = await connection.query(
            'SELECT estado FROM asientos WHERE id = ? FOR UPDATE',
            [asiento_id]
        );
        
        if (asiento[0].estado === 'ocupado') {
            await connection.rollback();
            return res.status(400).json({ error: 'El asiento ya está ocupado.' });
        }
        
        const codigo_reserva = 'CINE-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        
        await connection.query(
            'INSERT INTO reservas_cine (usuario_id, horario_id, asiento_id, codigo_reserva, total) VALUES (?, ?, ?, ?, ?)',
            [req.usuario.id, horario_id, asiento_id, codigo_reserva, total]
        );
        
        await connection.query(
            'UPDATE asientos SET estado = "ocupado" WHERE id = ?',
            [asiento_id]
        );
        
        await connection.commit();
        
        res.status(201).json({ codigo_reserva, message: 'Reserva creada exitosamente.' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Error al crear reserva.' });
    } finally {
        connection.release();
    }
});

// Obtener reserva por código
app.get('/api/reservas/codigo/:codigo', verificarToken, async (req, res) => {
    try {
        const [reservas] = await pool.query(
            `SELECT r.*, p.titulo as pelicula, h.sala, h.fecha, h.hora, a.fila, a.numero as asiento_numero
             FROM reservas_cine r
             JOIN horarios h ON r.horario_id = h.id
             JOIN peliculas p ON h.pelicula_id = p.id
             JOIN asientos a ON r.asiento_id = a.id
             WHERE r.codigo_reserva = ? AND r.usuario_id = ?`,
            [req.params.codigo, req.usuario.id]
        );
        
        if (reservas.length === 0) {
            return res.status(404).json({ error: 'Reserva no encontrada.' });
        }
        
        res.json(reservas[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener reserva.' });
    }
});

// Obtener mis reservas
app.get('/api/reservas/mis-reservas', verificarToken, async (req, res) => {
    try {
        const [reservas] = await pool.query(
            `SELECT r.*, p.titulo as pelicula, h.sala, h.fecha, h.hora, a.fila, a.numero as asiento_numero
             FROM reservas_cine r
             JOIN horarios h ON r.horario_id = h.id
             JOIN peliculas p ON h.pelicula_id = p.id
             JOIN asientos a ON r.asiento_id = a.id
             WHERE r.usuario_id = ?
             ORDER BY r.fecha_reserva DESC`,
            [req.usuario.id]
        );
        res.json(reservas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener reservas.' });
    }
});

// =============================================
// RUTAS DE PRODUCTOS (BAR)
// =============================================

// Obtener todos los productos
app.get('/api/productos', async (req, res) => {
    try {
        const [productos] = await pool.query(
            'SELECT * FROM productos WHERE stock > 0 ORDER BY categoria, nombre'
        );
        res.json(productos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener productos.' });
    }
});

// BUSCAR PRODUCTOS por nombre, descripción o categoría
app.get('/api/productos/buscar', async (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.json([]);
    }
    
    try {
        const [productos] = await pool.query(
            `SELECT * FROM productos 
             WHERE stock > 0 
             AND (nombre LIKE ? OR descripcion LIKE ? OR categoria LIKE ?)
             ORDER BY categoria, nombre`,
            [`%${q}%`, `%${q}%`, `%${q}%`]
        );
        res.json(productos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al buscar productos.' });
    }
});

// Crear producto (solo admin)
app.post('/api/productos', verificarToken, verificarAdmin, async (req, res) => {
    const { nombre, descripcion, precio, stock, categoria, imagen_url } = req.body;
    
    try {
        const [result] = await pool.query(
            'INSERT INTO productos (nombre, descripcion, precio, stock, categoria, imagen_url) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, descripcion, precio, stock, categoria, imagen_url]
        );
        
        res.status(201).json({ id: result.insertId, message: 'Producto creado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear producto.' });
    }
});

// Actualizar producto (solo admin)
app.put('/api/productos/:id', verificarToken, verificarAdmin, async (req, res) => {
    const { nombre, descripcion, precio, stock, categoria, imagen_url } = req.body;
    
    try {
        await pool.query(
            'UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ?, categoria = ?, imagen_url = ? WHERE id = ?',
            [nombre, descripcion, precio, stock, categoria, imagen_url, req.params.id]
        );
        
        res.json({ message: 'Producto actualizado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar producto.' });
    }
});

// Eliminar producto (solo admin)
app.delete('/api/productos/:id', verificarToken, verificarAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM productos WHERE id = ?', [req.params.id]);
        res.json({ message: 'Producto eliminado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar producto.' });
    }
});

// =============================================
// RUTAS DE PEDIDOS (BAR)
// =============================================

// Crear pedido
app.post('/api/pedidos/bar', verificarToken, async (req, res) => {
    const { productos, total } = req.body;
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Verificar stock
        for (const item of productos) {
            const [stockActual] = await connection.query(
                'SELECT stock FROM productos WHERE id = ? FOR UPDATE',
                [item.id]
            );
            
            if (stockActual[0].stock < item.cantidad) {
                await connection.rollback();
                return res.status(400).json({ error: 'Stock insuficiente para algunos productos.' });
            }
        }
        
        const codigo_pedido = 'BAR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        
        const [result] = await connection.query(
            'INSERT INTO pedidos_bar (usuario_id, codigo_pedido, total) VALUES (?, ?, ?)',
            [req.usuario.id, codigo_pedido, total]
        );
        
        for (const item of productos) {
            await connection.query(
                'INSERT INTO detalles_pedido (pedido_id, producto_id, cantidad, subtotal) VALUES (?, ?, ?, ?)',
                [result.insertId, item.id, item.cantidad, item.subtotal]
            );
            
            await connection.query(
                'UPDATE productos SET stock = stock - ? WHERE id = ?',
                [item.cantidad, item.id]
            );
        }
        
        await connection.commit();
        
        res.status(201).json({ codigo_pedido, message: 'Pedido creado exitosamente.' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Error al crear pedido.' });
    } finally {
        connection.release();
    }
});

// Obtener pedido por código
app.get('/api/pedidos/codigo/:codigo', verificarToken, async (req, res) => {
    try {
        const [pedidos] = await pool.query(
            `SELECT p.* 
             FROM pedidos_bar p
             WHERE p.codigo_pedido = ? AND p.usuario_id = ?`,
            [req.params.codigo, req.usuario.id]
        );
        
        if (pedidos.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado.' });
        }
        
        const [detalles] = await pool.query(
            `SELECT dp.*, pr.nombre, pr.precio
             FROM detalles_pedido dp
             JOIN productos pr ON dp.producto_id = pr.id
             WHERE dp.pedido_id = ?`,
            [pedidos[0].id]
        );
        
        res.json({ ...pedidos[0], detalles });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener pedido.' });
    }
});

// Obtener mis pedidos
app.get('/api/pedidos/mis-pedidos', verificarToken, async (req, res) => {
    try {
        const [pedidos] = await pool.query(
            `SELECT p.*, 
                    COUNT(dp.id) as total_productos,
                    SUM(dp.cantidad) as cantidad_total
             FROM pedidos_bar p
             LEFT JOIN detalles_pedido dp ON p.id = dp.pedido_id
             WHERE p.usuario_id = ?
             GROUP BY p.id
             ORDER BY p.fecha DESC`,
            [req.usuario.id]
        );
        res.json(pedidos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener pedidos.' });
    }
});

// =============================================
// RUTAS DE ESTADÍSTICAS (solo admin)
// =============================================

app.get('/api/admin/stats', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const [totalPeliculas] = await pool.query('SELECT COUNT(*) as total FROM peliculas');
        const [totalReservas] = await pool.query('SELECT COUNT(*) as total FROM reservas_cine');
        const [totalPedidos] = await pool.query('SELECT COUNT(*) as total FROM pedidos_bar');
        const [totalUsuarios] = await pool.query('SELECT COUNT(*) as total FROM usuarios');
        const [ingresosCine] = await pool.query('SELECT SUM(total) as total FROM reservas_cine');
        const [ingresosBar] = await pool.query('SELECT SUM(total) as total FROM pedidos_bar');
        
        res.json({
            peliculas: totalPeliculas[0].total,
            reservas: totalReservas[0].total,
            pedidos: totalPedidos[0].total,
            usuarios: totalUsuarios[0].total,
            ingresosCine: ingresosCine[0].total || 0,
            ingresosBar: ingresosBar[0].total || 0,
            ingresosTotales: (ingresosCine[0].total || 0) + (ingresosBar[0].total || 0)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener estadísticas.' });
    }
});

// =============================================
// RUTA PARA ACTUALIZAR PERFIL DE USUARIO
// =============================================

app.put('/api/usuarios/perfil', verificarToken, async (req, res) => {
    const { nombre, email, password } = req.body;
    
    try {
        // Verificar si el email ya está en uso por otro usuario
        if (email !== req.usuario.email) {
            const [existe] = await pool.query(
                'SELECT id FROM usuarios WHERE email = ? AND id != ?',
                [email, req.usuario.id]
            );
            if (existe.length > 0) {
                return res.status(400).json({ error: 'El email ya está registrado por otro usuario.' });
            }
        }
        
        let query = 'UPDATE usuarios SET nombre = ?, email = ?';
        const params = [nombre, email];
        
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += ', password = ?';
            params.push(hashedPassword);
        }
        
        query += ' WHERE id = ?';
        params.push(req.usuario.id);
        
        await pool.query(query, params);
        
        // Actualizar token con nuevos datos
        const nuevoToken = jwt.sign(
            { id: req.usuario.id, nombre, email, rol: req.usuario.rol },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({ 
            message: 'Perfil actualizado exitosamente',
            token: nuevoToken,
            usuario: { id: req.usuario.id, nombre, email, rol: req.usuario.rol }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar perfil.' });
    }
});

// =============================================
// RUTAS DE TARJETA
// =============================================

// Obtener tarjeta del usuario
app.get('/api/tarjeta', verificarToken, async (req, res) => {
    try {
        const [tarjeta] = await pool.query(
            'SELECT id, usuario_id, numero_tarjeta, saldo FROM tarjetas WHERE usuario_id = ?',
            [req.usuario.id]
        );
        
        if (tarjeta.length === 0) {
            return res.status(404).json({ error: 'No hay tarjeta registrada' });
        }
        
        res.json(tarjeta[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener tarjeta' });
    }
});

// Actualizar o crear tarjeta
app.put('/api/tarjeta', verificarToken, async (req, res) => {
    const { numero_tarjeta, saldo } = req.body;
    
    try {
        const [existe] = await pool.query(
            'SELECT id FROM tarjetas WHERE usuario_id = ?',
            [req.usuario.id]
        );
        
        if (existe.length === 0) {
            await pool.query(
                'INSERT INTO tarjetas (usuario_id, numero_tarjeta, saldo) VALUES (?, ?, ?)',
                [req.usuario.id, numero_tarjeta, saldo]
            );
        } else {
            await pool.query(
                'UPDATE tarjetas SET numero_tarjeta = ?, saldo = ? WHERE usuario_id = ?',
                [numero_tarjeta, saldo, req.usuario.id]
            );
        }
        
        res.json({ message: 'Tarjeta actualizada exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar tarjeta' });
    }
});

// Recargar saldo
app.post('/api/tarjeta/recargar', verificarToken, async (req, res) => {
    const { monto } = req.body;
    
    if (monto <= 0) {
        return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }
    
    try {
        await pool.query(
            'UPDATE tarjetas SET saldo = saldo + ? WHERE usuario_id = ?',
            [monto, req.usuario.id]
        );
        
        const [tarjeta] = await pool.query(
            'SELECT saldo FROM tarjetas WHERE usuario_id = ?',
            [req.usuario.id]
        );
        
        res.json({ message: 'Saldo recargado exitosamente', nuevo_saldo: tarjeta[0].saldo });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al recargar saldo' });
    }
});

// Procesar pago
app.post('/api/pagos/procesar', verificarToken, async (req, res) => {
    const { metodo, monto, numero_tarjeta } = req.body;
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        if (metodo === 'tarjeta') {
            const [tarjeta] = await connection.query(
                'SELECT saldo FROM tarjetas WHERE usuario_id = ?',
                [req.usuario.id]
            );
            
            if (tarjeta.length === 0) {
                throw new Error('No hay tarjeta registrada');
            }
            
            if (tarjeta[0].saldo < monto) {
                throw new Error('Saldo insuficiente');
            }
            
            await connection.query(
                'UPDATE tarjetas SET saldo = saldo - ? WHERE usuario_id = ?',
                [monto, req.usuario.id]
            );
        }
        
        await connection.commit();
        res.json({ success: true, message: 'Pago procesado exitosamente' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// =============================================
// INICIAR SERVIDOR
// =============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📊 Modo: ${isProduction ? 'PRODUCCIÓN (Aiven MySQL)' : 'DESARROLLO (Local MySQL)'}`);
});