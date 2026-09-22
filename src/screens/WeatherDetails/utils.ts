import { getWeatherIconName } from "@/utils/weatherApi";

export type DailyForecast = {
  day: string;
  icon: string;
  high: number;
  low: number;
  precipitation: number;
  condition: string;
};

export const formatCondition = (raw?: string) =>
  (raw ?? "")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export const processForecastData = (forecast: any): DailyForecast[] => {
  if (!forecast?.list) return [];

  const dailyData: Record<string, any> = {};

  forecast.list.forEach((item: any) => {
    const date = new Date(item.dt * 1000);
    const dayKey = date.toDateString();

    if (!dailyData[dayKey]) {
      dailyData[dayKey] = {
        date,
        temps: [],
        weather: item.weather[0],
        precipitation: item.pop || 0,
      };
    }

    dailyData[dayKey].temps.push(item.main.temp);
    dailyData[dayKey].precipitation = Math.max(
      dailyData[dayKey].precipitation,
      item.pop || 0,
    );
  });

  const days = Object.values(dailyData).slice(0, 7);

  return days.map((day: any, index: number) => {
    const dayName =
      index === 0
        ? "Today"
        : index === 1
          ? "Tomorrow"
          : day.date.toLocaleDateString("en-US", { weekday: "short" });

    return {
      day: dayName,
      icon: getWeatherIconName(day.weather.icon),
      high: Math.round(Math.max(...day.temps)),
      low: Math.round(Math.min(...day.temps)),
      precipitation: Math.round(day.precipitation * 100),
      condition: formatCondition(day.weather.description),
    };
  });
};

export const alertSeverityClasses = (severity: string) => {
  switch (severity) {
    case "high":
      return {
        border: "border-l-red-500",
        bg: "bg-red-50/80 dark:bg-red-950/30",
        text: "text-red-700 dark:text-red-300",
        accent: "#ef4444",
      };
    case "medium":
      return {
        border: "border-l-amber-500",
        bg: "bg-amber-50/80 dark:bg-amber-950/30",
        text: "text-amber-800 dark:text-amber-200",
        accent: "#f59e0b",
      };
    default:
      return {
        border: "border-l-blue-500",
        bg: "bg-blue-50/80 dark:bg-blue-950/30",
        text: "text-blue-800 dark:text-blue-200",
        accent: "#3b82f6",
      };
  }
};
