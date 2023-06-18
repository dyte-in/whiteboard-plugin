import './icon.css';
import iconPack from '../../icons/iconPack.json'

interface Props {
    icon: keyof typeof iconPack;
    className?: string;
    onClick?: (...args: any) => void;
}

const Icon = (props: Props) => {
    const { icon, className, onClick } = props;

  return (
    <div onClick={onClick} className={`icon-wrapper ${className}`} dangerouslySetInnerHTML={{
      __html: iconPack[icon]}}></div>
  )
}

export default Icon

Icon.defaultProps = {
  className: '',
  onClick: () => {},
}