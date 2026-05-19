-- =============================================
-- SISTEMA DE CINE - BASE DE DATOS COMPLETA
-- =============================================

DROP DATABASE IF EXISTS cine_db;
CREATE DATABASE cine_db;
USE cine_db;

-- =============================================
-- 1. TABLA DE USUARIOS
-- =============================================
CREATE TABLE usuarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    rol ENUM('cliente', 'admin') DEFAULT 'cliente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 2. TABLA DE PELÍCULAS
-- =============================================
CREATE TABLE peliculas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    duracion INT NOT NULL,
    genero VARCHAR(100),
    imagen_url VARCHAR(500),
    fecha_estreno DATE,
    estado ENUM('proximamente', 'cartelera', 'finalizada') DEFAULT 'cartelera',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 3. TABLA DE HORARIOS
-- =============================================
CREATE TABLE horarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pelicula_id INT NOT NULL,
    sala VARCHAR(10) NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pelicula_id) REFERENCES peliculas(id) ON DELETE CASCADE,
    INDEX idx_pelicula_fecha (pelicula_id, fecha)
);

-- =============================================
-- 4. TABLA DE ASIENTOS
-- =============================================
CREATE TABLE asientos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    horario_id INT NOT NULL,
    fila CHAR(1) NOT NULL,
    numero INT NOT NULL,
    estado ENUM('libre', 'ocupado') DEFAULT 'libre',
    FOREIGN KEY (horario_id) REFERENCES horarios(id) ON DELETE CASCADE,
    UNIQUE KEY unique_asiento (horario_id, fila, numero)
);

-- =============================================
-- 5. TABLA DE RESERVAS DE CINE
-- =============================================
CREATE TABLE reservas_cine (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    horario_id INT NOT NULL,
    asiento_id INT NOT NULL,
    codigo_reserva VARCHAR(50) UNIQUE NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    estado ENUM('activa', 'pagada', 'cancelada') DEFAULT 'activa',
    fecha_reserva TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (horario_id) REFERENCES horarios(id) ON DELETE CASCADE,
    FOREIGN KEY (asiento_id) REFERENCES asientos(id) ON DELETE CASCADE
);

-- =============================================
-- 6. TABLA DE PRODUCTOS (BAR)
-- =============================================
CREATE TABLE productos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    stock INT DEFAULT 0,
    categoria VARCHAR(50),
    imagen_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 7. TABLA DE PEDIDOS DEL BAR
-- =============================================
CREATE TABLE pedidos_bar (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    codigo_pedido VARCHAR(50) UNIQUE NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    estado ENUM('pendiente', 'pagado', 'entregado') DEFAULT 'pendiente',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- =============================================
-- 8. TABLA DE DETALLES DE PEDIDOS
-- =============================================
CREATE TABLE detalles_pedido (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pedido_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos_bar(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);

-- =============================================
-- TRIGGER PARA CREAR ASIENTOS AUTOMÁTICAMENTE
-- =============================================
DELIMITER //
CREATE TRIGGER after_horario_insert
AFTER INSERT ON horarios
FOR EACH ROW
BEGIN
    DECLARE v_fila INT DEFAULT 1;
    DECLARE v_num INT DEFAULT 1;
    DECLARE v_letra CHAR(1);
    
    WHILE v_fila <= 10 DO
        SET v_letra = CHAR(64 + v_fila);
        SET v_num = 1;
        WHILE v_num <= 15 DO
            INSERT INTO asientos (horario_id, fila, numero, estado)
            VALUES (NEW.id, v_letra, v_num, 'libre');
            SET v_num = v_num + 1;
        END WHILE;
        SET v_fila = v_fila + 1;
    END WHILE;
END//
DELIMITER ;

-- =============================================
-- DATOS DE PRUEBA - PELÍCULAS
-- =============================================
INSERT INTO peliculas (titulo, descripcion, duracion, genero, imagen_url, fecha_estreno) VALUES
('Dune: Parte 2', 'Paul Atreides se une a Chani y los Fremen mientras busca venganza contra los conspiradores que destruyeron a su familia.', 166, 'Ciencia Ficción', 'https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg', '2024-02-28'),
('Oppenheimer', 'La historia del físico J. Robert Oppenheimer y su papel en el desarrollo de la bomba atómica.', 180, 'Drama', 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', '2023-07-21'),
('Barbie', 'Barbie vive en Barbieland, pero después de ser expulsada, viaja al mundo real para encontrar la verdadera felicidad.', 114, 'Comedia', 'https://image.tmdb.org/t/p/w500/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg', '2023-07-21'),
('Spider-Man: Across the Spider-Verse', 'Miles Morales se embarca en una aventura a través del multiverso.', 140, 'Animación', 'https://image.tmdb.org/t/p/w500/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg', '2023-06-02'),
('John Wick 4', 'John Wick descubre un camino para derrotar a la Alta Mesa.', 169, 'Acción', 'https://image.tmdb.org/t/p/w500/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg', '2023-03-24'),
('Wonka', 'Sigue al joven Willy Wonka y cómo conoció a los Oompa-Loompas.', 116, 'Familiar', 'https://image.tmdb.org/t/p/w500/qhb1qOilapbapELWbcAyvdatQfA.jpg', '2023-12-15'),
('The Marvels', 'Carol Danvers, Kamala Khan y Monica Rambeau deben unir sus fuerzas.', 105, 'Acción', 'https://image.tmdb.org/t/p/w500/9GBhzXMFjgcZ3FdR9w3bUMMTps5.jpg', '2023-11-10'),
('Napoleón', 'La historia del ascenso y caída del emperador francés Napoleón Bonaparte.', 158, 'Historia', 'https://image.tmdb.org/t/p/w500/zE6TqLimrc8vnzfOwWgXbWZLqp4.jpg', '2023-11-22'),
('Deadpool 3', 'Deadpool se une a Wolverine para una misión imposible.', 127, 'Acción', 'https://image.tmdb.org/t/p/w500/8cdWjvZQUExUHTz3u6ND8Z4zW8s.jpg', '2024-07-26'),
('Intensamente 2', 'Nuevas emociones llegan a la mente de Riley.', 100, 'Animación', 'https://image.tmdb.org/t/p/w500/9Gtg2DzBhmYamXBS1hKAhiwdBv1.jpg', '2024-06-14');

-- =============================================
-- DATOS DE PRUEBA - HORARIOS (próximos días)
-- =============================================
INSERT INTO horarios (pelicula_id, sala, fecha, hora, precio) VALUES
(1, 'Sala 1', DATE_ADD(CURDATE(), INTERVAL 1 DAY), '16:00:00', 15.00),
(1, 'Sala 1', DATE_ADD(CURDATE(), INTERVAL 1 DAY), '19:30:00', 18.00),
(1, 'Sala 1', DATE_ADD(CURDATE(), INTERVAL 2 DAY), '16:00:00', 15.00),
(2, 'Sala 2', DATE_ADD(CURDATE(), INTERVAL 1 DAY), '17:00:00', 16.00),
(2, 'Sala 2', DATE_ADD(CURDATE(), INTERVAL 2 DAY), '20:00:00', 18.00),
(3, 'Sala 3', DATE_ADD(CURDATE(), INTERVAL 1 DAY), '15:30:00', 14.00),
(3, 'Sala 3', DATE_ADD(CURDATE(), INTERVAL 2 DAY), '18:00:00', 15.00),
(4, 'Sala 4', DATE_ADD(CURDATE(), INTERVAL 1 DAY), '18:00:00', 15.00),
(5, 'Sala 5', DATE_ADD(CURDATE(), INTERVAL 2 DAY), '20:00:00', 17.00),
(6, 'Sala 1', DATE_ADD(CURDATE(), INTERVAL 3 DAY), '14:00:00', 12.00),
(7, 'Sala 2', DATE_ADD(CURDATE(), INTERVAL 3 DAY), '16:30:00', 13.00),
(8, 'Sala 3', DATE_ADD(CURDATE(), INTERVAL 4 DAY), '19:00:00', 16.00),
(9, 'Sala 4', DATE_ADD(CURDATE(), INTERVAL 5 DAY), '21:00:00', 18.00),
(10, 'Sala 5', DATE_ADD(CURDATE(), INTERVAL 5 DAY), '15:00:00', 12.00);

-- =============================================
-- DATOS DE PRUEBA - PRODUCTOS DEL BAR
-- =============================================
INSERT INTO productos (nombre, descripcion, precio, stock, categoria, imagen_url) VALUES
('Palomitas Pequeñas', 'Deliciosas palomitas de maíz con mantequilla', 4.50, 100, 'Snacks', 'palomitas_peq.png'),
('Palomitas Grandes', 'Palomitas extragrandes para compartir', 6.50, 100, 'Snacks', 'palomitas_grandes.png'),
('Refresco 500ml', 'Refresco de cola 500ml bien frío', 3.00, 150, 'Bebidas', 'refresco.png'),
('Nachos con Queso', 'Nachos crujientes con salsa de queso', 5.50, 80, 'Snacks', 'nachos.png'),
('Perro Caliente', 'Perro caliente con salsa especial de la casa', 7.00, 50, 'Comida', 'hotdog.png'),
('Combo Palomitas + Refresco', 'Palomitas grandes + 2 refrescos', 8.50, 200, 'Combos', 'combo.png'),
('Chocolate', 'Barra de chocolate con leche', 2.50, 120, 'Dulces', 'chocolate.png'),
('Agua 500ml', 'Agua mineral sin gas', 2.00, 100, 'Bebidas', 'agua.png'),
('Hot Dog Especial', 'Hot dog con doble salchicha y queso', 6.50, 60, 'Comida', 'hotdog_especial.png'),
('Palomitas Caramelo', 'Palomitas cubiertas con caramelo', 5.50, 80, 'Snacks', 'palomitas_caramelo.png'),
('Gomitas', 'Bolsa de gomitas surtidas', 3.00, 90, 'Dulces', 'gomitas.png'),
('Café Americano', 'Café americano recién hecho', 4.00, 70, 'Bebidas', 'cafe.png'),
('Combo Familiar', '2 Palomitas grandes + 4 refrescos', 15.00, 50, 'Combos', 'combo_familiar.png'),
('Alfajor', 'Alfajor de chocolate', 2.00, 100, 'Dulces', 'alfajor.png'),
('Papas Fritas', 'Papas fritas con salsa', 4.50, 75, 'Snacks', 'papas.png');

-- =============================================
-- CONSULTAS ÚTILES PARA VERIFICAR DATOS
-- =============================================

-- Ver todas las películas
-- SELECT * FROM peliculas;

-- Ver horarios próximos
-- SELECT h.*, p.titulo FROM horarios h JOIN peliculas p ON h.pelicula_id = p.id WHERE h.fecha >= CURDATE() ORDER BY h.fecha, h.hora;

-- Ver productos con stock
-- SELECT * FROM productos WHERE stock > 0 ORDER BY categoria;

-- Ver asientos de un horario específico (ejemplo: horario_id = 1)
-- SELECT * FROM asientos WHERE horario_id = 1 ORDER BY fila, numero;

-- Ver reservas de un usuario específico (ejemplo: usuario_id = 1)
-- SELECT r.*, p.titulo as pelicula, h.sala, h.fecha, h.hora, a.fila, a.numero 
-- FROM reservas_cine r
-- JOIN horarios h ON r.horario_id = h.id
-- JOIN peliculas p ON h.pelicula_id = p.id
-- JOIN asientos a ON r.asiento_id = a.id
-- WHERE r.usuario_id = 1;

-- Tabla de tarjetas de usuario
CREATE TABLE tarjetas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL UNIQUE,
    numero_tarjeta VARCHAR(20) NOT NULL,
    saldo DECIMAL(10,2) DEFAULT 0,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Agregar columna de tipo de pago a pedidos_bar
ALTER TABLE pedidos_bar ADD COLUMN metodo_pago VARCHAR(50) DEFAULT 'efectivo';
ALTER TABLE pedidos_bar ADD COLUMN estado_pago VARCHAR(50) DEFAULT 'pendiente';

-- Insertar tarjeta de prueba para admin y cliente
INSERT INTO tarjetas (usuario_id, numero_tarjeta, saldo) 
SELECT id, '4242424242424242', 100.00 FROM usuarios WHERE email = 'admin@cine.com';

INSERT INTO tarjetas (usuario_id, numero_tarjeta, saldo) 
SELECT id, '5555555555554444', 50.00 FROM usuarios WHERE email = 'cliente@test.com';