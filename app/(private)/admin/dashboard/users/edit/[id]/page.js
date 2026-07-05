"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/libs/api";
import LoadingCircle from "@/components/common/LoadingCircle";
import UserForm from "@/components/admin/users/UserForm";

export default function EditUserPage({ params }) {
  const router = useRouter();
  const { id } = params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        console.log("Fetching user data for ID:", id);
        const response = await apiClient.get(`/admin/users/${id}`);

        if (response) {
          console.log("Setting user data:", response);
          setUserData(response);
        } else {
          console.error("No data in response");
          setError("Error loading user data");
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        setError(error.response?.data?.error || "Error loading user");
        if (error.response?.status === 401) {
          router.push("/auth/signin");
        }
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchUser();
    }
  }, [id, router]);

  const handleSubmit = async (data) => {
    setSaving(true);
    setError("");

    try {
      console.log("Submitting data:", data);
      await apiClient.put(`/admin/users/${id}`, data);
      router.push("/admin/dashboard/users");
      router.refresh();
    } catch (error) {
      console.error("Error updating user:", error);
      setError(error.response?.data?.error || "Error updating user");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <LoadingCircle />
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="alert alert-error">
          <span>Could not load user information</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex justify-between items-center pb-4">
              <div>
                <h1 className="text-3xl font-bold">Edit User ✏️</h1>
                <p className="text-gray-600">Modify user information</p>
              </div>
            </div>

            <UserForm
              mode="edit"
              initialData={userData}
              onSubmit={handleSubmit}
              isLoading={saving}
              error={error}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
