import { useState, useEffect } from 'react';
import { X, Upload, Trash2, LogOut } from 'lucide-react';
import './Admin.css';

const API_URL = 'https://studio-ayni-backend.onrender.com/api';

function Admin() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [productos, setProductos] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('');
  const [precio, setPrecio] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [imagenPrincipal, setImagenPrincipal] = useState(null);
  const [colores, setColores] = useState([]);
  const [novedad, setNovedad] = useState(false);

  // Verificar token al cargar
  useEffect(() => {
    if (token) {
      verificarToken();
      cargarProductos();
    }
  }, [token]);

  // Verificar token
  const verificarToken = async () => {
    try {
      const response = await fetch(`${API_URL}/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        handleLogout();
      }
    } catch (err) {
      handleLogout();
    }
  };

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar sesión');
      }

      localStorage.setItem('token', data.token);
      setToken(data.token);
      setSuccess('✅ Login exitoso!');
      setUsername('');
      setPassword('');
    } catch (err) {
      setError('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setSuccess('👋 Sesión cerrada');
  };

  // Cargar productos
  const cargarProductos = async () => {
    try {
      const response = await fetch(`${API_URL}/productos`);
      const data = await response.json();
      setProductos(data);
    } catch (err) {
      setError('Error al cargar productos');
    }
  };

  // Subir imagen de color
  const uploadColorImage = async (file) => {
    const formData = new FormData();
    formData.append('imagen', file);

    const response = await fetch(`${API_URL}/upload-color`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await response.json();
    return data.url;
  };

  // Agregar producto
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Subir imágenes de colores primero
      const coloresConImagenes = await Promise.all(
        colores.map(async (color) => {
          if (color.archivoImagen) {
            const url = await uploadColorImage(color.archivoImagen);
            return { nombre: color.nombre, hex: color.hex, imagen: url };
          }
          return { nombre: color.nombre, hex: color.hex };
        })
      );

      // Preparar FormData
      const formData = new FormData();
      formData.append('nombre', nombre);
      formData.append('categoria', categoria);
      formData.append('precio', precio);
      formData.append('descripcion', descripcion);
      formData.append('imagen', imagenPrincipal);
      formData.append('colores', JSON.stringify(coloresConImagenes));
      formData.append('novedad', novedad);

      const response = await fetch(`${API_URL}/productos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al guardar producto');
      }

      setSuccess('✅ Producto agregado exitosamente!');
      
      // Limpiar formulario
      setNombre('');
      setCategoria('');
      setPrecio('');
      setDescripcion('');
      setImagenPrincipal(null);
      setColores([]);
      setNovedad(false);
      document.getElementById('imagen-input').value = '';
      
      // Recargar productos
      cargarProductos();
    } catch (err) {
      setError('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Eliminar producto
  const eliminarProducto = async (id) => {
    if (!window.confirm('¿Eliminar este producto?')) return;
    
    try {
      const response = await fetch(`${API_URL}/productos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Error al eliminar');
      }

      setSuccess('🗑️ Producto eliminado');
      cargarProductos();
    } catch (err) {
      setError('❌ ' + err.message);
    }
  };

  // Agregar color
  const agregarColor = () => {
    setColores([...colores, { nombre: '', hex: '#6B7F3C', archivoImagen: null }]);
  };

  // Actualizar color
  const actualizarColor = (index, field, value) => {
    const nuevosColores = [...colores];
    nuevosColores[index][field] = value;
    setColores(nuevosColores);
  };

  // Eliminar color
  const eliminarColor = (index) => {
    setColores(colores.filter((_, i) => i !== index));
  };

  // Pantalla de Login
  if (!token) {
    return (
      <div className="admin-login">
        <div className="login-box">
          <h1>🔐 Panel Admin</h1>
          <p>STUDIO AYNI</p>
          
          {error && <div className="error-msg">{error}</div>}
          {success && <div className="success-msg">{success}</div>}
          
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Usuario o Email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? 'Iniciando...' : 'Iniciar Sesión'}
            </button>
          </form>
          
          <div className="help-text" style={{marginTop: '1.5rem', padding: '1rem', background: '#F5F0E8', borderRadius: '6px'}}>
            <p style={{marginBottom: '0.5rem'}}><strong>👤 Usuario por defecto:</strong></p>
            <p>Email: admin@ayni.com</p>
            <p>Contraseña: admin123</p>
          </div>
        </div>
      </div>
    );
  }

  // Panel de Admin
  return (
    <div className="admin-container">
      <div className="admin-header">
        <div>
          <h1>🎨 Panel de Administración</h1>
          <p>STUDIO AYNI</p>
        </div>
        <button onClick={handleLogout} className="btn-logout">
          <LogOut size={20} />
          Cerrar Sesión
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      <div className="admin-content">
        {/* FORMULARIO */}
        <div className="admin-form">
          <h2>➕ Agregar Producto</h2>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nombre del Producto *</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                placeholder="Ej: Maceta Geométrica"
              />
            </div>

            <div className="form-group">
              <label>Categoría *</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} required>
                <option value="">Seleccionar...</option>
                <option value="hogar">Hogar</option>
                <option value="organizadores">Organizadores</option>
                <option value="joyeria">Joyería</option>
                <option value="maquillaje">Maquillaje</option>
                <option value="bebes">Bebés</option>
                <option value="gadgets">Gadgets</option>
              </select>
            </div>

            <div className="form-group">
              <label>Precio (Bs) *</label>
              <input
                type="number"
                step="0.01"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                required
                placeholder="15.00"
              />
            </div>

            <div className="form-group">
              <label>Imagen Principal *</label>
              <input
                id="imagen-input"
                type="file"
                accept="image/*"
                onChange={(e) => setImagenPrincipal(e.target.files[0])}
                required
              />
              <p className="help-text">📸 Sube la foto principal del producto</p>
            </div>

            <div className="form-group">
              <label>Descripción *</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                required
                placeholder="Descripción del producto..."
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={novedad}
                  onChange={(e) => setNovedad(e.target.checked)}
                  className="checkbox-input"
                />
                <span className="checkbox-text">
                  ✨ Marcar como Novedad del Mes
                </span>
              </label>
              <p className="help-text">Los productos marcados aparecerán en el carrusel de novedades</p>
            </div>

            <div className="form-group">
              <label>Colores (Opcional)</label>
              {colores.map((color, index) => (
                <div key={index} className="color-input-group">
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={color.nombre}
                    onChange={(e) => actualizarColor(index, 'nombre', e.target.value)}
                  />
                  <input
                    type="color"
                    value={color.hex}
                    onChange={(e) => actualizarColor(index, 'hex', e.target.value)}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => actualizarColor(index, 'archivoImagen', e.target.files[0])}
                  />
                  <button type="button" onClick={() => eliminarColor(index)} className="btn-delete">
                    <X size={20} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={agregarColor} className="btn-add-color">
                + Agregar Color
              </button>
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? '⏳ Guardando...' : '✅ Guardar Producto'}
            </button>
          </form>
        </div>

        {/* INVENTARIO */}
        <div className="admin-inventory">
          <h2>📦 Inventario ({productos.length})</h2>
          
          <div className="product-list">
            {productos.length === 0 ? (
              <p className="empty-state">No hay productos. ¡Agrega el primero!</p>
            ) : (
              productos.map((producto) => (
                <div key={producto.id} className="product-item">
                  <img 
                    src={producto.imagen?.startsWith('http') ? producto.imagen : `https://studio-ayni-backend.onrender.com${producto.imagen}`} 
                    alt={producto.nombre} 
                  />
                  <div className="product-details">
                    <h3>
                      {producto.nombre}
                      {producto.novedad && (
                        <span className="novedad-badge-admin">✨ NOVEDAD</span>
                      )}
                    </h3>
                    <p className="product-category">{producto.categoria}</p>
                    <p className="product-price">Bs {producto.precio}</p>
                    {producto.colores && producto.colores.length > 0 && (
                      <div className="product-colors">
                        {producto.colores.map((color, i) => (
                          <span
                            key={i}
                            className="color-dot"
                            style={{ backgroundColor: color.hex }}
                            title={color.nombre}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => eliminarProducto(producto.id)}
                    className="btn-delete-product"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Admin;