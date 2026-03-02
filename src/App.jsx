import AppRoutes from "./routes/AppRoutes";
import Header from "./components/Header";
import Footer from "./components/Footer";
import CustomCursor from "./components/CustomCursor";
import SmoothScroll from "./components/SmoothScroll";
import WhatsAppButton from "./components/WhatsAppButton";

function App() {
  return (
    <>
      <CustomCursor />
      <SmoothScroll />
      <Header />
      <AppRoutes />
      <Footer />
      <WhatsAppButton/>
    </>
  );
}

export default App;