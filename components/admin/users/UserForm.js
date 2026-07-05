"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function UserForm({
  mode = "create",
  initialData = null,
  onSubmit,
  isLoading = false,
  error = "",
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "user",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (mode === "edit" && initialData) {
      setFormData({
        name: initialData.name || "",
        email: initialData.email || "",
        role: initialData.role || "user",
      });
    }
  }, [mode, initialData]);

  const roleOptions = [
    { value: "user", label: "User" },
    { value: "admin", label: "Admin" },
    { value: "editor", label: "Editor" },
    { value: "moderator", label: "Moderator" },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.role) {
      newErrors.role = "Role is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="form-control w-full">
        <label className="label">
          <span className="label-text">
            Name <span className="text-red-500">*</span>
          </span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter full name"
          className={`input input-bordered w-full ${errors.name ? 'input-error' : ''}`}
        />
        {errors.name && (
          <label className="label">
            <span className="label-text-alt text-red-500">{errors.name}</span>
          </label>
        )}
      </div>

      <div className="form-control w-full">
        <label className="label">
          <span className="label-text">
            Email <span className="text-red-500">*</span>
          </span>
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Enter email address"
          disabled={mode === "edit"}
          className={`input input-bordered w-full ${errors.email ? 'input-error' : ''} ${mode === "edit" ? 'input-disabled' : ''}`}
        />
        {errors.email && (
          <label className="label">
            <span className="label-text-alt text-red-500">{errors.email}</span>
          </label>
        )}
      </div>

      <div className="form-control w-full">
        <label className="label">
          <span className="label-text">
            Role <span className="text-red-500">*</span>
          </span>
        </label>
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          className={`select select-bordered w-full ${errors.role ? 'select-error' : ''}`}
        >
          {roleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.role && (
          <label className="label">
            <span className="label-text-alt text-red-500">{errors.role}</span>
          </label>
        )}
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              {mode === "create" ? "Creating..." : "Updating..."}
            </>
          ) : (
            mode === "create" ? "Create User" : "Update User"
          )}
        </button>
        
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => window.history.back()}
          disabled={isLoading}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
