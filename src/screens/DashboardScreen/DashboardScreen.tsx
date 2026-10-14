import { Link } from 'react-router'

const DashboardScreen = () => {
  return (
    <>
      <h1>Dashboard</h1>
      <Link to="/agent">Go to Agent Screen</Link>
    </>
  )
}

export default DashboardScreen