import React from "react";

export function splitAppointmentServices(serviceName: string): string[] {
  const trimmed = serviceName.trim();
  if (!trimmed) return [];
  if (!trimmed.includes(" + ")) return [trimmed];
  return trimmed.split(" + ").map((part) => part.trim()).filter(Boolean);
}

type AppointmentServiceListProps = {
  serviceName: string;
  className?: string;
  lineClassName?: string;
};

export default function AppointmentServiceList({
  serviceName,
  className = "",
  lineClassName = "",
}: AppointmentServiceListProps) {
  const services = splitAppointmentServices(serviceName);

  if (services.length <= 1) {
    return <p className={lineClassName || className}>{serviceName}</p>;
  }

  return (
    <div className={`space-y-0.5 ${className}`}>
      {services.map((service, index) => (
        <p key={`${service}-${index}`} className={lineClassName}>
          {service}
        </p>
      ))}
    </div>
  );
}
