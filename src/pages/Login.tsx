import { useState } from "react";
import { LoginForm, SignupForm } from "@/components/auth";

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);

  return isSignUp ? (
    <SignupForm onToggleMode={() => setIsSignUp(false)} />
  ) : (
    <LoginForm onToggleMode={() => setIsSignUp(true)} />
  );
}
