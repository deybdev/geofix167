import AppRouter from "../router";
import { Toaster } from "../shared/components/ui/toast";
import ErrorBoundary from "../pages/errors/ErrorBoundary";

const App = () => {
  return (
    <ErrorBoundary>
      <AppRouter />

      <Toaster
        timeout={4500}
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
    </ErrorBoundary>
  );
};

export default App;
