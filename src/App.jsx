import AppRoutes from "./routes/AppRoutes";
import Header from "./components/Header";
import Footer from "./components/Footer";
import CustomCursor from "./components/CustomCursor";
import SmoothScroll from "./components/SmoothScroll";
import WhatsAppButton from "./components/WhatsAppButton";
import ScrollToTop from "./components/ScrollToTop";

function App() {
  return (
    <>
      <ScrollToTop />
      <CustomCursor />
      <SmoothScroll />
      <Header />
      <AppRoutes />
      <Footer />
      <WhatsAppButton />
    </>
  );
}

export default App;