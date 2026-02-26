import React, { useState } from "react";
import Login from "./Login";
import Invoice from "./Invoice";   // your main page

function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div>
      <h3>Welcome {user.username} 👋</h3>
      <Invoice />
    </div>
  );
}

export default App;
