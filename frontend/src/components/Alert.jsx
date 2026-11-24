export default function Alert({ type = "danger", children, onClose }) {
  if (!children) return null;
  return <div className={`alert alert-${type} alert-dismissible`} role="alert">
    {children}
    {onClose && <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />}
  </div>;
}