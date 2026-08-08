import { Link } from 'react-router-dom';
import LogoMark from './LogoMark';

export default function Brand({ light = false }) {
  return <Link className={`brand${light ? ' brand--light' : ''}`} to="/"><LogoMark light={light} />ShowMaster<span>.</span></Link>;
}
