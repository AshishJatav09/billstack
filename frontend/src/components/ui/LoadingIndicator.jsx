import { LoaderCircle } from "lucide-react";

const LoadingIndicator = ({ label = "Loading", compact = false, className = "" }) => (
  <span role="status" aria-live="polite" className={`inline-flex items-center justify-center gap-2 ${className}`}>
    <LoaderCircle className="animate-spin text-brand-600" size={compact ? 17 : 24} aria-hidden="true" />
    {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
  </span>
);

export default LoadingIndicator;
