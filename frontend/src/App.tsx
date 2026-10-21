import { Route, Routes } from "react-router"
import AgentScreen from "./screens/AgentScreen/AgentScreen"
import DashboardScreen from "./screens/DashboardScreen/DashboardScreen"

function App() {

  return (
    <Routes>
       <Route path = "/" element = {<DashboardScreen />}/>
       <Route path = "/agent" element = {<AgentScreen />}/>
    </Routes>
  )
}

export default App
