"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/libs/api";
import UserForm from "@/components/admin/users/UserForm";

export default function NewUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (data) => {
    setLoading(true);
    setError("");

    try {
      await apiClient.post("/admin/users", data);
      router.push("/admin/dashboard/users");
      router.refresh();
    } catch (error) {
      console.error("Error creating user:", error);
      setError(error.response?.data?.error || "Error al crear el usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex justify-between items-center pb-4">
              <div>
                <h1 className="text-3xl font-bold">Agregar Usuario 👤</h1>
                <p className="text-gray-600">
                  Crear una nueva cuenta de usuario
                </p>
              </div>
            </div>

            <UserForm
              mode="create"
              onSubmit={handleSubmit}
              isLoading={loading}
              error={error}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
