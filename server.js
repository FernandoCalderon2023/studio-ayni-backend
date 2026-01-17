const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET_KEY = process.env.SECRET_KEY || 'CAMBIA-ESTO-POR-CLAVE-SEGURA-123';

// ============================================
// CONFIGURACIÓN DE SUPABASE
// ============================================
const supabaseUrl = 'https://omdzbitywwccricrdjnd.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// CONFIGURACIÓN DE CLOUDINARY
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dhlqwu0oe',
  api_key: process.env.CLOUDINARY_API_KEY || '369226422217697',
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ============================================
// CONFIGURACIÓN DE CORS
// ============================================
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://studio-ayni.vercel.app',
  'https://studio-ayni-frontend-o3uv.vercel.app',
  'https://studio-ayni-frontend.vercel.app',
  'https://fernandocalderon2023.github.io'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (origin === allowed) return true;
      if (origin.startsWith(allowed)) return true;
      if (allowed.includes('vercel.app') && origin.includes('vercel.app')) return true;
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.error('CORS Error - Origin not allowed:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ============================================
// CONFIGURACIÓN DE CLOUDINARY STORAGE
// ============================================
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'studio-ayni',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
  }
});

const upload = multer({ storage: storage });

// ============================================
// MIDDLEWARE DE AUTENTICACIÓN
// ============================================
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
// INICIALIZACIÓN - CREAR USUARIO ADMIN
// ============================================
async function initializeAdmin() {
  try {
    const { data: existingUser } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', 'admin@ayni.com')
      .single();

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const { error } = await supabase
        .from('usuarios')
        .insert([{
          email: 'admin@ayni.com',
          password: hashedPassword,
          role: 'admin'
        }]);
      
      if (!error) {
        console.log('✅ Usuario admin creado: admin@ayni.com / admin123');
      }
    } else {
      console.log('ℹ️  Usuario admin ya existe');
    }
  } catch (error) {
    console.log('⚠️  Error inicializando admin:', error.message);
  }
}

// Ejecutar inicialización
setTimeout(initializeAdmin, 2000);

// ============================================
// RUTAS DE AUTENTICACIÓN
// ============================================

// POST - Login (acepta username o email)
app.post('/api/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    
    // Buscar usuario por username o email
    const loginField = username || email;
    const isEmail = loginField && loginField.includes('@');
    
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .or(isEmail ? `email.eq.${loginField}` : `username.eq.${loginField}`)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        username: user.username,
        role: user.role 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
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
app.get('/api/productos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error getting productos:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener un producto por ID
app.get('/api/productos/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error getting producto:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Agregar producto
app.post('/api/productos', verificarToken, upload.single('imagen'), async (req, res) => {
  try {
    const { nombre, categoria, precio, descripcion, colores, novedad } = req.body;

    const nuevoProducto = {
      nombre,
      categoria,
      precio: parseFloat(precio),
      descripcion,
      imagen: req.file ? req.file.path : null,
      colores: colores ? JSON.parse(colores) : [],
      novedad: novedad === 'true' || novedad === true
    };

    const { data, error } = await supabase
      .from('productos')
      .insert([nuevoProducto])
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Producto agregado:', data.nombre);
    res.json({ success: true, producto: data });
  } catch (error) {
    console.error('Error adding producto:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar producto
app.put('/api/productos/:id', verificarToken, upload.single('imagen'), async (req, res) => {
  try {
    const { nombre, categoria, precio, descripcion, colores, novedad } = req.body;

    // Obtener producto actual
    const { data: productoActual } = await supabase
      .from('productos')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!productoActual) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const productoActualizado = {
      nombre,
      categoria,
      precio: parseFloat(precio),
      descripcion,
      imagen: req.file ? req.file.path : productoActual.imagen,
      colores: colores ? JSON.parse(colores) : productoActual.colores,
      novedad: novedad === 'true' || novedad === true,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('productos')
      .update(productoActualizado)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Producto actualizado:', data.nombre);
    res.json({ success: true, producto: data });
  } catch (error) {
    console.error('Error updating producto:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Eliminar producto
app.delete('/api/productos/:id', verificarToken, async (req, res) => {
  try {
    // Obtener producto para eliminar imagen de Cloudinary
    const { data: producto } = await supabase
      .from('productos')
      .select('imagen')
      .eq('id', req.params.id)
      .single();

    if (producto && producto.imagen && producto.imagen.includes('cloudinary.com')) {
      try {
        const publicId = producto.imagen.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId);
        console.log('✅ Imagen eliminada de Cloudinary');
      } catch (error) {
        console.error('Error eliminando imagen:', error);
      }
    }

    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    console.log('✅ Producto eliminado');
    res.json({ success: true, message: 'Producto eliminado' });
  } catch (error) {
    console.error('Error deleting producto:', error);
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
      cliente,
      productos,
      total: parseFloat(total),
      metodo_pago: metodoPago || 'whatsapp',
      estado: 'pendiente'
    };

    const { data, error } = await supabase
      .from('pedidos')
      .insert([nuevoPedido])
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Pedido creado:', data.id);
    res.json({ success: true, pedido: data });
  } catch (error) {
    console.error('Error creating pedido:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener todos los pedidos
app.get('/api/pedidos', verificarToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error getting pedidos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS DE USUARIOS
// ============================================

// GET - Obtener usuarios
app.get('/api/usuarios', verificarToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, email, role, created_at');

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error getting usuarios:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTA DE SALUD
// ============================================

app.get('/api/health', async (req, res) => {
  try {
    // Probar conexión a Supabase
    const { data, error } = await supabase
      .from('productos')
      .select('count');

    res.json({ 
      status: 'OK',
      timestamp: new Date().toISOString(),
      cloudinary: cloudinary.config().cloud_name ? 'configured' : 'not configured',
      supabase: error ? 'error' : 'connected',
      database: error ? 'disconnected' : 'connected',
      cors: 'enabled',
      allowedOrigins: allowedOrigins
    });
  } catch (error) {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      supabase: 'error',
      error: error.message
    });
  }
});

// ============================================
// RUTA ROOT
// ============================================

app.get('/', (req, res) => {
  res.json({
    message: 'Studio AYNI API with Supabase',
    version: '2.0.0',
    database: 'Supabase PostgreSQL',
    endpoints: {
      health: '/api/health',
      productos: '/api/productos',
      pedidos: '/api/pedidos',
      login: '/api/login'
    }
  });
});

// ============================================
// INICIO DEL SERVIDOR
// ============================================

if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`
 ╔════════════════════════════════════════╗
 ║ 🎨 SERVIDOR STUDIO AYNI - SUPABASE   ║
 ╠════════════════════════════════════════╣
 ║  Puerto: ${PORT}                      ║
 ║  API: http://localhost:${PORT}/api    ║
 ║                                        ║
 ║  👤 Usuario por defecto:              ║
 ║     Email: admin@ayni.com             ║
 ║     Pass: admin123                    ║
 ║                                        ║
 ║  💾 Base de datos: Supabase          ║
 ║  🔗 URL: omdzbitywwccricrdjnd        ║
 ║  ☁️  Cloudinary: ${cloudinary.config().cloud_name || 'No configurado'} ║
 ║  🔒 CORS: Habilitado                  ║
 ╚════════════════════════════════════════╝
    `);
  });
}