import { ArrowRight, Cpu, CircuitBoard, MemoryStick, MonitorCog } from "lucide-react";
import { Link } from "react-router-dom";

function BuildPcBanner({ config = {} }) {
  const eyebrow = config.eyebrow || "PC BUILDER";
  const titleFirst = config.titleFirst || "Build Your";
  const titleHighlight = config.titleHighlight || "Dream PC";
  const description = config.description || "Choose the right components for gaming, work, editing and everything in between.";
  const buttonText = config.buttonText || "Explore Components";
  const buttonUrl = config.buttonUrl || "/products?category=CPUs";
  return (
    <section className="build-pc-section">
      <div className="build-pc-content">
        <div className="build-pc-text">
          <span className="build-pc-label">{eyebrow}</span>
          <h2>{titleFirst}<br /><span>{titleHighlight}</span></h2>
          <p>{description}</p>
          <Link className="build-pc-button" to={buttonUrl}>{buttonText}<ArrowRight size={17} /></Link>
        </div>
        <div className="build-pc-components">
          <div className="build-component"><Cpu size={28} /><span>CPU</span></div>
          <div className="build-component"><CircuitBoard size={28} /><span>Motherboard</span></div>
          <div className="build-component"><MemoryStick size={28} /><span>RAM</span></div>
          <div className="build-component"><MonitorCog size={28} /><span>GPU</span></div>
        </div>
      </div>
    </section>
  );
}

export default BuildPcBanner;
