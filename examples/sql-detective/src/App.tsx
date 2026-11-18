import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Root from "./pages/root";
import Home from "./pages/home";
import Cases from "./pages/cases";
import Level from "./pages/level";
import Dead from "./pages/dead";
import Ranking from "./pages/ranking";
import Finish from "./pages/finish";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Root />}>
          <Route path="" element={<Home />} />

          <Route
            path="cases"
            element={<Cases />}
          />

          <Route
            path="level"
            element={<Level />}
          />

          <Route
            path="end"
            element={<Dead />}
          />

          <Route
            path="finish"
            element={<Finish />}
          />

          <Route
            path="ranking"
            element={<Ranking />}
          />
        </Route>

        <Route
          path="*"
          element={<Navigate to="/" />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
