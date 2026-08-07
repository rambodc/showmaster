import { Link } from 'react-router-dom';

export default function Brand({ light = false }) {
  return <Link className={`brand${light ? ' brand--light' : ''}`} to="/">ShowMaster<span>.</span></Link>;
}
