import AppRoutes from "./routes/AppRoutes";
import Header from "./components/Header";
import Footer from "./components/Footer";
import CustomCursor from "./components/CustomCursor";
import SmoothScroll from "./components/SmoothScroll";
import ScrollToTop from "./components/ScrollToTop";
import ChatBot from "./components/Chatbot";

function App() {
  return (
    <>
     
      <CustomCursor />
      <SmoothScroll />
      <ChatBot/>
      <Header />
      <AppRoutes />
      <Footer />
    </>
  );
}

export default App;