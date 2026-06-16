import { Navigate, useLocation } from "react-router-dom";

// /profile is samengevoegd met /dashboard. We bewaren de route en redirecten
// naar de juiste tab zodat oude links blijven werken.
export default function Profile() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const tab = params.get("tab") || "profiel";
  return <Navigate to={`/dashboard?tab=${tab}`} replace />;
}
