import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Activity, ArrowDownToLine, Boxes, CalendarDays, Check, CircleDollarSign,
  Clock3, LogOut, Plus, RefreshCw, Search, ShoppingBag, TrendingUp,
  X, AlertTriangle, PackagePlus, Pencil, Trash2
} from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const money = (value) => new Intl.NumberFormat("en-GH", {
  style: "currency", currency: "GHS", maximumFractionDigits: 2
}).format(Number(value || 0));

const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [tab, setTab] = useState("sales");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: "", sku: "", price: "", low_stock: "5" });
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockQty, setRestockQty] = useState("1");
  const [reportDate, setReportDate] = useState(todayString());

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) {
      setProducts([]);
      setSales([]);
      setStockMovements([]);
      return;
    }
    loadData();
    const channel = supabase.channel("pilma-stock-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => loadProducts())
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => loadSales())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function loadData() {
    await Promise.all([loadProducts(), loadSales(), loadMovements()]);
  }

  async function loadProducts() {
    const { data, error } = await supabase.from("products").select("*").eq("active", true).order("name");
    if (error) return showNotice("error", error.message);
    setProducts(data || []);
  }

  async function loadSales() {
    const { data, error } = await supabase.from("sales")
      .select("id, created_at, total, payment_method, sold_by, sale_items(id, product_name, quantity, unit_price, line_total)")
      .order("created_at", { ascending: false }).limit(500);
    if (error) return showNotice("error", error.message);
    setSales(data || []);
  }

  async function loadMovements() {
    const { data, error } = await supabase.from("stock_movements")
      .select("id, created_at, movement_type, quantity, note, product_id, products(name)")
      .order("created_at", { ascending: false }).limit(100);
    if (!error) setStockMovements(data || []);
  }

  function showNotice(type, text) {
    setNotice({ type, text });
    window.setTimeout(() => setNotice({ type: "", text: "" }), 4500);
  }

  async function handleAuth(e) {
    e.preventDefault();
    setAuthMessage("");
    if (!supabase) return;
    const action = authMode === "signin"
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });
    const { error, data } = await action;
    if (error) return setAuthMessage(error.message);
    if (authMode === "signup" && !data.session) {
      setAuthMessage("Account created. Check your email to confirm it, then sign in.");
    } else {
      setAuthMessage("");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function sellOne(product) {
    if (product.stock_qty < 1) return showNotice("error", `${product.name} is out of stock.`);
    setBusyId(product.id);
    const { error } = await supabase.rpc("record_sale", {
      p_product_id: product.id,
      p_quantity: 1,
      p_payment_method: "cash"
    });
    setBusyId(null);
    if (error) return showNotice("error", error.message);
    showNotice("success", `Sold 1 × ${product.name}. Stock updated.`);
    await Promise.all([loadProducts(), loadSales(), loadMovements()]);
  }

  function openNewProduct() {
    setEditingProduct(null);
    setProductForm({ name: "", sku: "", price: "", low_stock: "5" });
    setShowProductForm(true);
  }

  function openEditProduct(product) {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      sku: product.sku || "",
      price: String(product.price),
      low_stock: String(product.low_stock ?? 5)
    });
    setShowProductForm(true);
  }

  async function saveProduct(e) {
    e.preventDefault();
    const price = Number(productForm.price);
    const lowStock = Number(productForm.low_stock);
    if (!productForm.name.trim() || !Number.isFinite(price) || price < 0 || !Number.isFinite(lowStock) || lowStock < 0) {
      return showNotice("error", "Enter a product name, a valid price and a valid low-stock level.");
    }
    const payload = {
      name: productForm.name.trim(),
      sku: productForm.sku.trim() || null,
      price,
      low_stock: Math.floor(lowStock)
    };
    let result;
    if (editingProduct) {
      result = await supabase.from("products").update(payload).eq("id", editingProduct.id);
    } else {
      result = await supabase.from("products").insert({ ...payload, stock_qty: 0, active: true });
    }
    if (result.error) return showNotice("error", result.error.message);
    setShowProductForm(false);
    showNotice("success", editingProduct ? "Product updated." : "Product added. Use Restock to enter the quantity received.");
    await loadProducts();
  }

  async function archiveProduct(product) {
    if (!window.confirm(`Hide ${product.name} from the sales screen? Past sales will be retained.`)) return;
    const { error } = await supabase.from("products").update({ active: false }).eq("id", product.id);
    if (error) return showNotice("error", error.message);
    showNotice("success", `${product.name} hidden from the sales screen.`);
    await loadProducts();
  }

  async function doRestock(e) {
    e.preventDefault();
    const quantity = Number(restockQty);
    if (!Number.isInteger(quantity) || quantity < 1) return showNotice("error", "Enter a whole-number quantity greater than zero.");
    const { error } = await supabase.rpc("restock_product", {
      p_product_id: restockProduct.id,
      p_quantity: quantity,
      p_note: "Reception stock received"
    });
    if (error) return showNotice("error", error.message);
    showNotice("success", `Added ${quantity} × ${restockProduct.name} to stock.`);
    setRestockProduct(null);
    setRestockQty("1");
    await Promise.all([loadProducts(), loadMovements()]);
  }

  const filteredProducts = useMemo(() => products.filter((p) =>
    `${p.name} ${p.sku || ""}`.toLowerCase().includes(search.toLowerCase())
  ), [products, search]);

  const reportSales = useMemo(() => sales.filter(s => {
    const d = new Date(s.created_at);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` === reportDate;
  }), [sales, reportDate]);

  const todayTotal = useMemo(() => sales.filter(s => {
    const d = new Date(s.created_at);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` === todayString();
  }).reduce((sum, s) => sum + Number(s.total), 0), [sales]);

  const todayCount = sales.filter(s => {
    const d = new Date(s.created_at);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` === todayString();
  }).length;
  const totalUnits = products.reduce((sum, p) => sum + Number(p.stock_qty), 0);
  const lowStockCount = products.filter(p => Number(p.stock_qty) <= Number(p.low_stock)).length;

  if (!supabase) return <SetupMissing />;
  if (loading) return <div className="center-screen"><div className="loader" /><p>Loading Pilma Hotel POS…</p></div>;
  if (!session) return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">P</div>
        <p className="eyebrow">PILMA HOTEL</p>
        <h1>Reception Stock & POS</h1>
        <p className="muted">Manage drinks, biscuits and other reception items in one shared stock system.</p>
        <form onSubmit={handleAuth} className="form-stack">
          <label>Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="reception@pilmahotel.com" /></label>
          <label>Password<input type="password" autoComplete={authMode === "signin" ? "current-password" : "new-password"} minLength="6" required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" /></label>
          {authMessage && <div className="inline-message">{authMessage}</div>}
          <button className="btn btn-primary btn-full" type="submit">{authMode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
        <p className="auth-switch">{authMode === "signin" ? "New receptionist?" : "Already registered?"} <button className="text-button" onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthMessage(""); }}>{authMode === "signin" ? "Create account" : "Sign in"}</button></p>
        <p className="tiny muted">Use a separate login for each receptionist. Stock and sales are shared across all signed-in users.</p>
      </section>
    </main>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-mark small">P</div><div><strong>PILMA HOTEL</strong><span>Reception POS</span></div></div>
        <nav className="nav-list">
          <button className={tab === "sales" ? "nav-item active" : "nav-item"} onClick={() => setTab("sales")}><ShoppingBag size={18} /> Sales / Checkout</button>
          <button className={tab === "products" ? "nav-item active" : "nav-item"} onClick={() => setTab("products")}><Boxes size={18} /> Products & Stock</button>
          <button className={tab === "reports" ? "nav-item active" : "nav-item"} onClick={() => setTab("reports")}><TrendingUp size={18} /> Sales reports</button>
          <button className={tab === "movements" ? "nav-item active" : "nav-item"} onClick={() => setTab("movements")}><Activity size={18} /> Stock history</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="user-chip"><div className="avatar">{(session.user.email || "R").slice(0,1).toUpperCase()}</div><div className="user-text"><strong>Receptionist</strong><span>{session.user.email}</span></div></div>
          <button className="nav-item signout" onClick={signOut}><LogOut size={18} /> Sign out</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">HOTEL OPERATIONS</p><h1>{({sales:"Sales / Checkout",products:"Products & Stock",reports:"Sales Reports",movements:"Stock History"})[tab]}</h1></div>
          <div className="topbar-right"><span className="live-pill"><span className="live-dot" /> Shared stock</span><button className="icon-btn" title="Refresh data" onClick={loadData}><RefreshCw size={18}/></button></div>
        </header>

        {notice.text && <div className={`toast ${notice.type}`}><span>{notice.type === "success" ? <Check size={18}/> : <AlertTriangle size={18}/>}</span>{notice.text}<button onClick={() => setNotice({type:"",text:""})}><X size={16}/></button></div>}

        <section className="stats-grid">
          <Stat icon={<CircleDollarSign size={19}/>} label="Sales today" value={money(todayTotal)} />
          <Stat icon={<ShoppingBag size={19}/>} label="Transactions today" value={todayCount} />
          <Stat icon={<Boxes size={19}/>} label="Units in stock" value={totalUnits} />
          <Stat icon={<AlertTriangle size={19}/>} label="Low-stock items" value={lowStockCount} warning={lowStockCount > 0} />
        </section>

        {tab === "sales" && <section className="panel">
          <div className="panel-heading"><div><h2>Quick sale</h2><p>Tap a product once to sell one unit and automatically reduce stock.</p></div><button className="btn btn-secondary" onClick={() => setTab("products")}><PackagePlus size={16}/> Manage stock</button></div>
          <div className="search-wrap"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search drinks, biscuits, water…" /></div>
          {filteredProducts.length === 0 ? <EmptyState title="No products found" detail="Add products in Products & Stock to start selling."/> :
            <div className="product-grid">{filteredProducts.map(product => <article className={`product-card ${product.stock_qty <= product.low_stock ? "low-stock" : ""}`} key={product.id}>
              <div className="product-card-top"><div className="product-icon"><ShoppingBag size={21}/></div><span className={product.stock_qty < 1 ? "stock-badge out" : product.stock_qty <= product.low_stock ? "stock-badge low" : "stock-badge"}>{product.stock_qty} left</span></div>
              <h3>{product.name}</h3><p className="product-sku">{product.sku || "No SKU"}</p><div className="product-card-bottom"><strong>{money(product.price)}</strong><button className="btn btn-primary sell-btn" disabled={product.stock_qty < 1 || busyId === product.id} onClick={() => sellOne(product)}>{busyId === product.id ? "Saving…" : <><Plus size={16}/> Sell 1</>}</button></div>
            </article>)}</div>}
        </section>}

        {tab === "products" && <section className="panel">
          <div className="panel-heading"><div><h2>Products & stock</h2><p>Add items, update prices, and record stock received.</p></div><button className="btn btn-primary" onClick={openNewProduct}><Plus size={17}/> Add product</button></div>
          <div className="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Price</th><th>In stock</th><th>Alert at</th><th>Actions</th></tr></thead><tbody>
            {products.map(p => <tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.sku || "—"}</td><td>{money(p.price)}</td><td><span className={p.stock_qty <= p.low_stock ? "qty-alert" : ""}>{p.stock_qty}</span></td><td>{p.low_stock}</td><td><div className="action-row"><button className="btn btn-small btn-secondary" onClick={() => {setRestockProduct(p);setRestockQty("1");}}><PackagePlus size={15}/> Restock</button><button className="icon-btn" title="Edit product" onClick={() => openEditProduct(p)}><Pencil size={16}/></button><button className="icon-btn danger-icon" title="Hide product" onClick={() => archiveProduct(p)}><Trash2 size={16}/></button></div></td></tr>)}
          </tbody></table>{products.length === 0 && <EmptyState title="No products yet" detail="Add your first reception item."/ >}</div>
          <p className="help-note"><AlertTriangle size={16}/> Restocking records each delivery in the stock history. Hiding a product does not delete its sales history.</p>
        </section>}

        {tab === "reports" && <section className="panel">
          <div className="panel-heading"><div><h2>Sales report</h2><p>Review transactions and revenue for a selected date.</p></div><label className="date-field"><CalendarDays size={17}/><input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}/></label></div>
          <div className="report-summary"><div><span>Total revenue</span><strong>{money(reportSales.reduce((sum,s) => sum + Number(s.total), 0))}</strong></div><div><span>Transactions</span><strong>{reportSales.length}</strong></div><div><span>Units sold</span><strong>{reportSales.reduce((sum,s) => sum + (s.sale_items || []).reduce((n,item) => n + Number(item.quantity),0),0)}</strong></div></div>
          <div className="table-wrap"><table><thead><tr><th>Time</th><th>Items sold</th><th>Payment</th><th>Total</th></tr></thead><tbody>
            {reportSales.map(s => <tr key={s.id}><td>{new Date(s.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</td><td>{(s.sale_items || []).map(i => `${i.product_name} × ${i.quantity}`).join(", ")}</td><td><span className="payment-tag">{s.payment_method || "cash"}</span></td><td><strong>{money(s.total)}</strong></td></tr>)}
          </tbody></table>{reportSales.length === 0 && <EmptyState title="No sales on this date" detail="Completed sales will appear here."/ >}</div>
          <button className="btn btn-secondary export-btn" onClick={() => exportSales(reportSales)}><ArrowDownToLine size={16}/> Export this report as CSV</button>
        </section>}

        {tab === "movements" && <section className="panel">
          <div className="panel-heading"><div><h2>Stock history</h2><p>Track sales deductions and new stock received.</p></div><button className="btn btn-secondary" onClick={loadMovements}><RefreshCw size={16}/> Refresh</button></div>
          <div className="table-wrap"><table><thead><tr><th>Date & time</th><th>Product</th><th>Movement</th><th>Quantity</th><th>Note</th></tr></thead><tbody>
            {stockMovements.map(m => <tr key={m.id}><td>{new Date(m.created_at).toLocaleString()}</td><td>{m.products?.name || "Product"}</td><td><span className={`movement-tag ${m.movement_type}`}>{m.movement_type === "sale" ? "Sale" : "Restock"}</span></td><td className={m.movement_type === "sale" ? "qty-negative" : "qty-positive"}>{m.movement_type === "sale" ? "−" : "+"}{m.quantity}</td><td>{m.note || "—"}</td></tr>)}
          </tbody></table>{stockMovements.length === 0 && <EmptyState title="No stock movements yet" detail="Sales and restocks will appear here."/ >}</div>
        </section>}

        <footer className="footer"><span>© {new Date().getFullYear()} Pilma Hotel</span><span><Clock3 size={14}/> Shared live inventory · GH₵</span></footer>
      </main>

      {showProductForm && <Modal title={editingProduct ? "Edit product" : "Add a product"} onClose={() => setShowProductForm(false)}>
        <form className="form-stack" onSubmit={saveProduct}>
          <label>Product name<input required autoFocus value={productForm.name} onChange={e => setProductForm({...productForm,name:e.target.value})} placeholder="e.g. Bottled water"/></label>
          <label>SKU / product code (optional)<input value={productForm.sku} onChange={e => setProductForm({...productForm,sku:e.target.value})} placeholder="e.g. WATER-500"/></label>
          <label>Selling price (GH₵)<input type="number" required min="0" step="0.01" value={productForm.price} onChange={e => setProductForm({...productForm,price:e.target.value})} placeholder="5.00"/></label>
          <label>Low-stock alert when quantity is at or below<input type="number" required min="0" step="1" value={productForm.low_stock} onChange={e => setProductForm({...productForm,low_stock:e.target.value})}/></label>
          <p className="tiny muted">After adding a new product, use Restock to enter the quantity you physically have.</p>
          <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowProductForm(false)}>Cancel</button><button className="btn btn-primary" type="submit">{editingProduct ? "Save changes" : "Add product"}</button></div>
        </form>
      </Modal>}

      {restockProduct && <Modal title={`Restock ${restockProduct.name}`} onClose={() => setRestockProduct(null)}>
        <form className="form-stack" onSubmit={doRestock}>
          <div className="restock-current"><span>Current quantity</span><strong>{restockProduct.stock_qty}</strong></div>
          <label>Quantity received<input type="number" required min="1" step="1" autoFocus value={restockQty} onChange={e => setRestockQty(e.target.value)}/></label>
          <p className="tiny muted">The quantity will be added to existing stock and saved to the stock history.</p>
          <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setRestockProduct(null)}>Cancel</button><button className="btn btn-primary" type="submit"><PackagePlus size={16}/> Add stock</button></div>
        </form>
      </Modal>}
    </div>
  );
}

function Stat({icon,label,value,warning}) {
  return <div className="stat-card"><div className={`stat-icon ${warning ? "warn" : ""}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>;
}

function EmptyState({title,detail}) {
  return <div className="empty-state"><div className="empty-icon"><Boxes size={23}/></div><strong>{title}</strong><p>{detail}</p></div>;
}

function Modal({title,children,onClose}) {
  return <div className="modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) onClose();}}><section className="modal"><div className="modal-heading"><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>{children}</section></div>;
}

function exportSales(rows) {
  const header = ["Date","Time","Items","Payment","Total (GHS)"];
  const data = rows.map(s => [
    new Date(s.created_at).toLocaleDateString(),
    new Date(s.created_at).toLocaleTimeString(),
    (s.sale_items || []).map(i => `${i.product_name} x ${i.quantity}`).join("; "),
    s.payment_method || "cash",
    Number(s.total).toFixed(2)
  ]);
  const csv = [header,...data].map(row => row.map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  const a = document.createElement("a");
  a.href = url; a.download = `pilma-hotel-sales-${todayString()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function SetupMissing() {
  return <main className="auth-shell"><section className="auth-card"><div className="brand-mark">P</div><p className="eyebrow">PILMA HOTEL</p><h1>Finish setup first</h1><p className="muted">The app needs your Supabase project URL and publishable/anon key.</p><ol className="setup-list"><li>Create a Supabase project.</li><li>Copy <code>.env.example</code> to a new file named <code>.env</code>.</li><li>Fill in the two values, then restart the development server.</li></ol></section></main>;
}
