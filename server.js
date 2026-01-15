const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET_KEY = process.env.SECRET_KEY || 'CAMBIA-ESTO-POR-CLAVE-SEGURA-123';

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dhlqwu0oe',
  api_key: process.env.CLOUDINARY_API_KEY || '369226422217697',
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'https://studio-ayni-frontend-o3uv.vercel.app',
  'https://fernandocalderon2023.github.io'
];

app.use(cors({
  origin: function(origin, callback) {
    // 1. Permitir peticiones sin origen (como Postman o Server-to-Server)
    if (!origin) return callback(null, true);
    
    // 2. Verificar si el origen está en la lista o si es UN SUBDOMINIO de vercel.app de tu proyecto
    const isAllowed = allowedOrigins.includes(origin) || 
                      origin.includes('vercel.app'); // Esto permite cualquier URL de vercel

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log("Origen bloqueado por CORS:", origin); // Esto te ayudará a ver qué URL exacta falla
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Crear carpeta data si no existe
if (!fs.existsSync('data')) fs.mkdirSync('data');

// Configuración de Cloudinary Storage para multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'studio-ayni',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
  }
});

const upload = multer({ storage: storage });

// Archivos de datos
const PRODUCTOS_FILE = path.join(__dirname, 'data', 'productos.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const PEDIDOS_FILE = path.join(__dirname, 'data', 'pedidos.json');

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
    password: hashedPassword,
    role: 'admin'
  }]));
}

if (!fs.existsSync(PEDIDOS_FILE)) {
  fs.writeFileSync(PEDIDOS_FILE, JSON.stringify([]));
}

// Funciones auxiliares
const readJSON = (filename) => {
  try {
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (error) {
    return [];
  }
};

const writeJSON = (filename, data) => {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
};

// Middleware de autenticación
const verificarToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// ============================================
// RUTAS DE AUTENTICACIÓN
// ============================================

// POST - Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = readJSON(USERS_FILE);
    
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Verificar token
app.get('/api/verify', verificarToken, (req, res) => {
  res.json({ valid: true });
});

// ============================================
// RUTAS DE PRODUCTOS
// ============================================

// GET - Obtener todos los productos
app.get('/api/productos', (req, res) => {
  try {
    const productos = readJSON(PRODUCTOS_FILE);
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener un producto por ID
app.get('/api/productos/:id', (req, res) => {
  try {
    const productos = readJSON(PRODUCTOS_FILE);
    const producto = productos.find(p => p.id === parseInt(req.params.id));
    
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json(producto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Agregar producto (con Cloudinary)
app.post('/api/productos', verificarToken, upload.single('imagen'), async (req, res) => {
  try {
    const { nombre, categoria, precio, descripcion, colores, novedad } = req.body;

    const nuevoProducto = {
      id: Date.now(),
      nombre,
      categoria,
      precio: parseFloat(precio),
      descripcion,
      imagen: req.file ? req.file.path : null, // URL de Cloudinary
      colores: colores ? JSON.parse(colores) : [],
      novedad: novedad === 'true' || novedad === true,
      createdAt: new Date().toISOString()
    };

    const productos = readJSON(PRODUCTOS_FILE);
    productos.push(nuevoProducto);
    writeJSON(PRODUCTOS_FILE, productos);

    res.json({ success: true, producto: nuevoProducto });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Eliminar producto
app.delete('/api/productos/:id', verificarToken, async (req, res) => {
  try {
    const productos = readJSON(PRODUCTOS_FILE);
    const index = productos.findIndex(p => p.id === parseInt(req.params.id));
    
    if (index === -1) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Opcional: Eliminar imagen de Cloudinary
    const producto = productos[index];
    if (producto.imagen && producto.imagen.includes('cloudinary.com')) {
      try {
        const publicId = producto.imagen.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (error) {
        console.error('Error eliminando imagen de Cloudinary:', error);
      }
    }

    productos.splice(index, 1);
    writeJSON(PRODUCTOS_FILE, productos);

    res.json({ success: true, message: 'Producto eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS DE PEDIDOS
// ============================================

// POST - Crear pedido
app.post('/api/pedidos', async (req, res) => {
  try {
    const { cliente, productos, total, metodoPago } = req.body;

    const nuevoPedido = {
      id: Date.now(),
      cliente,
      productos,
      total,
      metodoPago,
      estado: 'pendiente',
      createdAt: new Date().toISOString()
    };

    const pedidos = readJSON(PEDIDOS_FILE);
    pedidos.push(nuevoPedido);
    writeJSON(PEDIDOS_FILE, pedidos);

    res.json({ success: true, pedido: nuevoPedido });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener todos los pedidos (requiere autenticación)
app.get('/api/pedidos', verificarToken, (req, res) => {
  try {
    const pedidos = readJSON(PEDIDOS_FILE);
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS DE USUARIOS
// ============================================

// GET - Obtener usuarios (solo para admin)
app.get('/api/usuarios', verificarToken, (req, res) => {
  try {
    const users = readJSON(USERS_FILE);
    const usersWithoutPassword = users.map(({ password, ...user }) => user);
    res.json(usersWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTA DE SALUD
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    cloudinary: cloudinary.config().cloud_name ? 'configured' : 'not configured'
  });
});

// ============================================
// INICIO DEL SERVIDOR
// ============================================

// Para Vercel serverless
if (process.env.VERCEL) {
  module.exports = app;
} else {
  // Para desarrollo local y Render
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
 ║  ☁️  Cloudinary: ${cloudinary.config().cloud_name || 'No configurado'} ║
 ║  ⚠️  CAMBIA LA CONTRASEÑA!            ║
 ╚════════════════════════════════════════╝
    `);
  });
}