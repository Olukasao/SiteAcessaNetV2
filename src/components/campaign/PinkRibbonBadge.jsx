import "./pinkRibbonBadge.css";
import { Ribbon } from "lucide-react";

export default function PinkRibbonBadge({
  label = "Outubro Rosa",
  className = "",
  iconSize = 12,
}) {
  return (
    <span className={`pink-ribbon-badge ${className}`.trim()}>
      <Ribbon size={iconSize} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
