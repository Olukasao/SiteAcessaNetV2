import AppRoutes from "./routes/AppRoutes";
import Header from "./components/Header";
import Footer from "./components/Footer";
import CustomCursor from "./components/CustomCursor";
import SmoothScroll from "./components/SmoothScroll";
import WhatsAppButton from "./components/WhatsAppButton";
import ScrollToTop from "./components/ScrollToTop";
import ChatBot from "./components/Chatbot";

function App() {
  return (
    <>
      <ScrollToTop />
      <CustomCursor />
      <SmoothScroll />
      <Header />
      <AppRoutes />
      <Footer />
      <ChatBot/>
    </>
  );
}

export default App;