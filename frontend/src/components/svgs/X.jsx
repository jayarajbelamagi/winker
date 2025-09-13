const WinkerSvg = (props) => (
  <svg viewBox="0 0 220 110" {...props}>
    {/* Stylized W using text with skew to look like two V's */}
    <text
      x="0"
      y="70"
      fontSize="100"
      fontWeight="bold"
      fill="currentColor"
      transform="skewX(-20)"
    >
      W
    </text>
    {/* Smaller 'inker' */}
    <text x="100" y="70" fontSize="55" fontWeight="bold" fill="currentColor" transform="skewX(-20)">
      inker
    </text>
  </svg>
);

export default WinkerSvg;
