import AppRouter from "../router";
import { Toaster } from "../shared/components/ui/toast";

const App = () => {
  return (
    <>
      <AppRouter />

      <Toaster
        duration={Infinity}
        timeout={3500}
        toastClassName="
          bg-white
          shadow-lg
          rounded-xl
          p-2
        "
        titleClassName="
          text-[14px] font-semibold
          text-gray-900
          ml-2
        "
        descriptionClassName="
          text-[13px] leading-relaxed
          text-gray-500
          ml-2
        "
      />
    </>
  );
};

export default App;