import AppRoutes from "./routes/AppRoutes";
import Header from "./components/Header";
import Footer from "./components/Footer";
import CustomCursor from "./components/CustomCursor";
import ScrollToTop from "./components/ScrollToTop";
import ChatBot from "./components/Chatbot";
import VersionWatcher from "./components/VersionWatcher";
import { useLocation } from "react-router-dom";

function App() {
  const location = useLocation();
  const isGuideRoute = location.pathname === "/cliente/guia-wifi";
  const isCustomerAreaRoute = location.pathname.startsWith("/cliente") && !isGuideRoute;
  const hideSiteChrome = isGuideRoute || isCustomerAreaRoute;

  return (
    <>
      <ScrollToTop/>
      <VersionWatcher />
      {!hideSiteChrome && <CustomCursor />}
      {!hideSiteChrome && <ChatBot/>}
      {!hideSiteChrome && <Header />}
      <AppRoutes />
      {!hideSiteChrome && <Footer />}
    </>
  );
}

export default App;
