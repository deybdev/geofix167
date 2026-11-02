import logo from "../../assets/images/logo.png";

export default function Logo({
  inverse = false,
  showCard = true,
  className = "",
}) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      {showCard ? (
        <div className="flex h-17 w-17 items-center justify-center rounded-md bg-white shadow-lg">
          <img src={logo} alt="GeoFix 167 logo" className="h-15 object-contain" />
        </div>
      ) : (
        <img src={logo} alt="GeoFix 167 logo" className="h-15 object-contain" />
      )}
      <h1 className={`mt-5 text-3xl font-bold tracking-tight ${inverse ? "text-white" : "text-primary"}`}>
        GeoFix 167
      </h1>
      <p className={`mt-2 text-lg ${inverse ? "text-white" : "text-primary"}`}>
        Barangay 167
      </p>
    </div>
  );
}
