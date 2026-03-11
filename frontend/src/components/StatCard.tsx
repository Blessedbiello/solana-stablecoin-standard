"use client";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  color?: "indigo" | "green" | "red" | "yellow" | "blue";
}

const colorMap = {
  indigo: "text-indigo-400",
  green: "text-green-400",
  red: "text-red-400",
  yellow: "text-yellow-400",
  blue: "text-blue-400",
};

export function StatCard({
  title,
  value,
  subtitle,
  color = "indigo",
}: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <p className="text-sm font-medium text-gray-400">{title}</p>
      <p className={`mt-2 text-3xl font-bold ${colorMap[color]}`}>{value}</p>
      {subtitle && (
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      )}
    </div>
  );
}
