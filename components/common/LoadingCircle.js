const LoadingCircle = ({
  size = "md",
  color = "primary",
  variant = "spinner",
  className = "",
}) => {
  const sizeClasses = {
    xs: "loading-xs",
    sm: "loading-sm",
    md: "loading-md",
    lg: "loading-lg",
  };

  const colorClasses = {
    primary: "text-primary",
    secondary: "text-secondary",
    accent: "text-accent",
    neutral: "text-neutral",
    info: "text-info",
    success: "text-success",
    warning: "text-warning",
    error: "text-error",
  };

  const variants = {
    spinner: "loading-spinner",
    dots: "loading-dots",
    ring: "loading-ring",
    ball: "loading-ball",
    bars: "loading-bars",
    infinity: "loading-infinity",
  };

  return (
    <div className={`flex justify-center items-center p-8 ${className}`}>
      <span
        className={`loading ${variants[variant]} ${sizeClasses[size]} ${colorClasses[color]}`}
      ></span>
    </div>
  );
};

export default LoadingCircle;
