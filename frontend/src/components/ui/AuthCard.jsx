const AuthCard = ({ title, subtitle, children }) => {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
      </div>
      {children}
    </div>
  );
};

export default AuthCard;
