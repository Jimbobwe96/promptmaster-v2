// "use client";

// import { useSocket } from '../hooks/useSocket';
// import { useRouter } from "next/navigation";

// export default function LandingPage() {
//   const socket = useSocket();
//   const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');
//   const router = useRouter();

//   return (
//     <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4">
//       {/* Title Section */}
//       <div className="text-center mb-16">
//         <h1 className="text-6xl font-bold text-white mb-4">PromptMaster</h1>
//         <p className="text-xl text-slate-400">
//           The AI Image Prompt Guessing Game
//         </p>
//       </div>

//       {/* Buttons Section */}
//       <div className="flex flex-col gap-4 w-full max-w-xs">
//         <button
//           onClick={() => router.push("/create")}
//           className="h-14 px-8 text-lg font-medium text-white bg-blue-600 hover:bg-blue-700
//                      rounded-lg transition-colors duration-200
//                      transform hover:scale-[1.02] active:scale-[0.98]"
//         >
//           Create Lobby
//         </button>
//         <button
//           onClick={() => router.push("/join")}
//           className="h-14 px-8 text-lg font-medium text-white
//                      border-2 border-slate-400 hover:border-slate-300
//                      rounded-lg transition-colors duration-200
//                      transform hover:scale-[1.02] active:scale-[0.98]"
//         >
//           Join Lobby
//         </button>
//       </div>
//     </div>
//   );
// }
"use client";

import { useSocket } from "../hooks/useSocket";
import { useEffect, useState } from "react";

export default function Home() {
  const socket = useSocket();
  const [connectionStatus, setConnectionStatus] =
    useState<string>("Connecting...");

  useEffect(() => {
    // Update connection status whenever socket connection changes
    if (socket?.connected) {
      setConnectionStatus("Connected");
    } else {
      setConnectionStatus("Disconnected");
    }
  }, [socket?.connected]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">PromptMaster</h1>
      <p className="text-lg">
        Socket Status:{" "}
        <span
          className={
            connectionStatus === "Connected" ? "text-green-500" : "text-red-500"
          }
        >
          {connectionStatus}
        </span>
      </p>
    </div>
  );
}
