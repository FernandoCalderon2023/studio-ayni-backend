const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET_KEY = 'CAMBIA-ESTO-POR-CLAVE-SEGURA-123';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Crear carpetas si no existen
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('data')) fs.mkdirSync('data');

// Configurar multer para subir imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Archivos de datos
const PRODUCTOS_FILE = path.join(__dirname, 'data', 'productos.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Inicializar archivos si no existen
if (!fs.existsSync(PRODUCTOS_FILE)) {
  fs.writeFileSync(PRODUCTOS_FILE, JSON.stringify([]));
}

if (!fs.existsSync(USERS_FILE)) {
  // Crear usuario por defecto: admin@ayni.com / admin123
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  fs.writeFileSync(USERS_FILE, JSON.stringify([{
    id: 1,
    email: 'admin@ayni.com',
    password: hashedPassword
  }]));
}

// Helpers
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf-8'));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

// ==================== RUTAS DE AUTENTICACIÓN ====================

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '24h' });
  res.json({ token, email: user.email });
});

// Verificar token
app.get('/api/verify', authenticateToken, (req, res) => {
  res.json({ email: req.user.email });
});

// ==================== RUTAS DE PRODUCTOS ====================

// Obtener todos los productos (PÚBLICO)
app.get('/api/productos', (req, res) => {
  const productos = readJSON(PRODUCTOS_FILE);
  res.json(productos);
});

// Agregar producto (PROTEGIDO)
app.post('/api/productos', authenticateToken, upload.single('imagen'), (req, res) => {
  try {
    const productos = readJSON(PRODUCTOS_FILE);
    const { nombre, categoria, precio, descripcion, colores, novedad } = req.body;

    const nuevoProducto = {
      id: Date.now(),
      nombre,
      categoria,
      precio: parseFloat(precio),
      descripcion,
      imagen: req.file ? `/uploads/${req.file.filename}` : null,
      colores: colores ? JSON.parse(colores) : [],
      novedad: novedad === 'true' || novedad === true,
      createdAt: new Date().toISOString()
    };

    productos.push(nuevoProducto);
    writeJSON(PRODUCTOS_FILE, productos);

    res.json({ success: true, producto: nuevoProducto });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Subir imagen de color
app.post('/api/upload-color', authenticateToken, upload.single('imagen'), (req, res) => {
  try {
    res.json({ url: `/uploads/${req.file.filename}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar producto (PROTEGIDO)
app.delete('/api/productos/:id', authenticateToken, (req, res) => {
  try {
    const productos = readJSON(PRODUCTOS_FILE);
    const id = parseInt(req.params.id);
    
    const producto = productos.find(p => p.id === id);
    if (producto) {
      // Eliminar imagen del producto
      if (producto.imagen) {
        const imagePath = path.join(__dirname, producto.imagen);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      }
      
      // Eliminar imágenes de colores
      if (producto.colores) {
        producto.colores.forEach(color => {
          if (color.imagen) {
            const colorImagePath = path.join(__dirname, color.imagen);
            if (fs.existsSync(colorImagePath)) fs.unlinkSync(colorImagePath);
          }
        });
      }
    }

    const nuevosProductos = productos.filter(p => p.id !== id);
    writeJSON(PRODUCTOS_FILE, nuevosProductos);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== RUTAS DE PEDIDOS ====================

const PEDIDOS_FILE = path.join(__dirname, 'data', 'pedidos.json');

// Inicializar archivo de pedidos si no existe
if (!fs.existsSync(PEDIDOS_FILE)) {
  fs.writeFileSync(PEDIDOS_FILE, JSON.stringify([]));
}

// Crear pedido (PÚBLICO - cualquiera puede hacer pedidos)
app.post('/api/pedidos', (req, res) => {
  try {
    const pedidos = readJSON(PEDIDOS_FILE);
    const nuevoPedido = {
      id: Date.now(),
      ...req.body,
      estado: 'pendiente',
      createdAt: new Date().toISOString()
    };

    pedidos.push(nuevoPedido);
    writeJSON(PEDIDOS_FILE, pedidos);

    res.json({ success: true, pedido: nuevoPedido });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener todos los pedidos (PROTEGIDO)
app.get('/api/pedidos', authenticateToken, (req, res) => {
  try {
    const pedidos = readJSON(PEDIDOS_FILE);
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar estado de pedido (PROTEGIDO)
app.patch('/api/pedidos/:id', authenticateToken, (req, res) => {
  try {
    const pedidos = readJSON(PEDIDOS_FILE);
    const id = parseInt(req.params.id);
    const { estado } = req.body;

    const pedidoIndex = pedidos.findIndex(p => p.id === id);
    if (pedidoIndex === -1) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    pedidos[pedidoIndex].estado = estado;
    pedidos[pedidoIndex].updatedAt = new Date().toISOString();
    
    writeJSON(PEDIDOS_FILE, pedidos);
    res.json({ success: true, pedido: pedidos[pedidoIndex] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SERVIDOR ====================

// Para Vercel serverless
if (process.env.VERCEL) {
  module.exports = app;
} else {
  // Para desarrollo local
  app.listen(PORT, () => {
    console.log(`
 ╔════════════════════════════════════════╗
 ║ 🎨 SERVIDOR STUDIO AYNI INICIADO     ║
 ╠════════════════════════════════════════╣
 ║  Puerto: ${PORT}                      ║
 ║  API: http://localhost:${PORT}/api    ║
 ║                                        ║
 ║  👤 Usuario por defecto:              ║
 ║     Email: admin@ayni.com             ║
 ║     Pass: admin123                    ║
 ║                                        ║
 ║  ⚠️  CAMBIA LA CONTRASEÑA!            ║
 ╚════════════════════════════════════════╝
    `);
  });
}