"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "./style.css";

import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebaseClient";

function confirmPassword(password: string, confirm: string) {
  return password === confirm;
}

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!confirmPassword(password, confirm)) {
      setError("Passwords do not match");
      return;
    }
    createUserWithEmailAndPassword(auth, email, password)
      .then(() => {
        window.alert("Account created!");
        router.push("/");
      })
      .catch((err) => {
        setError(err.message);
        window.alert(err.message);
      });
  }

  return (
    <main className="auth-shell">
      <div className="auth-grid">
        <section className="auth-hero">
          <p className="pill">Create your account</p>
          <h1 className="hero-title">Lets get you started.</h1>
          <p className="hero-subtitle">
            Unlock our game by creating an account, make sure to have a strong password.
          </p>
          <div className="hero-stats">
            <div className="stat-card">
              <p className="stat-label"></p>
              <p className="stat-value">Upper case character</p>
            </div>
            <div className="stat-card">
              <p className="stat-label"></p>
              <p className="stat-value">Lower case character</p>
            </div>
            <div className="stat-card">
              <p className="stat-label"></p>
              <p className="stat-value">Numeric character</p>
            </div>
            <div className="stat-card">
              <p className="stat-label"></p>
              <p className="stat-value">Minimum 8 characters</p>
            </div>
          </div>
        </section>

        <section className="auth-card">
          <header className="card-header">
            <div>
              <p className="eyebrow">Sign up</p>
              <h2 className="card-title">Create your account</h2>
              <p className="card-subtitle">Use an email and a strong password.</p>
            </div>
          </header>

          <form className="auth-form" onSubmit={onSubmit}>
            <label className="input-label" htmlFor="username">
              Email
            </label>
            <input
              className="auth-input"
              id="username"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />

            <label className="input-label" htmlFor="password">
              Password
            </label>
            <input
              className="auth-input"
              id="password"
              type="password"
              placeholder="********"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />

            <label className="input-label" htmlFor="confirm">
              Confirm password
            </label>
            <input
              className="auth-input"
              id="confirm"
              type="password"
              placeholder="********"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />

            <button className="btn-primary" type="submit">
              Create Account
            </button>
          </form>

          <div className="card-footer">
            <Link href="/" className="link-ghost">
              Back to sign in
            </Link>
            <Link href="/game" className="link-ghost">
              View the game
            </Link>
          </div>

          {error && <p className="error-text">{error}</p>}
        </section>
      </div>
    </main>
  );
}
