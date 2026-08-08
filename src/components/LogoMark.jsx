export default function LogoMark({ className = "", light = false }) {
  return <img className={`showmaster-mark ${className}`} src={light ? "/showmaster-glyph-light.svg" : "/showmaster-mark.svg"} alt="" aria-hidden="true" />;
}
