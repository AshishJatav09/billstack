const AuthCard = ({ title, subtitle, children }) => {
  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>{title}</h2>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
      </div>
      {children}
    </div>
  );
};

export default AuthCard;
