export default function Loading() {
  return (
    <div className="page-loading">
      <span className="spinner page-loading-spinner" aria-hidden="true" />
      <strong>טוען נתונים...</strong>
      <p className="muted">המערכת מעדכנת את המסך ומכינה את התוכן הבא.</p>
    </div>
  );
}
