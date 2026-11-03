"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServiceSelector } from "@/components/ServiceSelector";
import { DynamicCredentialForm } from "@/components/DynamicCredentialForm";
import { getServiceMetadata } from "@/lib/services";
import type { ServiceType, Credential } from "@/lib/types";

export default function NewCredentialPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [serviceType, setServiceType] = useState<ServiceType>("postgresql");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverCredentials, setServerCredentials] = useState<Credential[]>([]);

  // Load server credentials from the project
  useEffect(() => {
    async function loadServers() {
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            // Filter only server-type credentials (vm-server, ssh-server, etc)
            const servers = data.data.credentials.filter((cred: Credential) =>
              ["vm-server", "ssh-server", "ftp", "sftp"].includes(cred.type)
            );
            setServerCredentials(servers);
          }
        }
      } catch (error) {
        console.error("Failed to load servers:", error);
      }
    }
    loadServers();
  }, [projectId]);

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);

    try {
      // Prepare credential data
      const { name, description, linkedServers, ...fields } = formData;

      // Convert string numbers to actual numbers where appropriate
      const processedFields: Record<string, any> = {};
      const serviceMetadata = getServiceMetadata(serviceType);

      if (serviceMetadata) {
        Object.keys(fields).forEach((key) => {
          const fieldDef = serviceMetadata.fields.find((f) => f.name === key);
          if (fieldDef && fieldDef.type === "number" && fields[key]) {
            processedFields[key] = parseInt(fields[key]) || 0;
          } else {
            processedFields[key] = fields[key];
          }
        });
      }

      const credential = {
        projectId,
        name,
        description: description || "",
        type: serviceType,
        fields: processedFields,
        linkedServers: linkedServers || [],
      };

      const response = await fetch(`/api/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });

      const result = await response.json();

      if (result.success) {
        router.push(`/dashboard/projects/${projectId}`);
      } else {
        console.error("Failed to create credential:", result.error);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Failed to create credential:", error);
      setIsSubmitting(false);
    }
  };

  // Dynamic form rendering is now handled by DynamicCredentialForm component

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <Link href={`/dashboard/projects/${projectId}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Project
          </Button>
        </Link>
        <h1 className="text-4xl font-black text-gray-900 mb-2">Add New Credential</h1>
        <p className="text-gray-600">Store access credentials securely for your infrastructure</p>
      </div>

      {/* Service Type Selection */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Select Service Type</CardTitle>
            <p className="text-gray-600">Choose from 78+ supported DevOps services</p>
          </CardHeader>
          <CardContent>
            <ServiceSelector onSelect={setServiceType} selected={serviceType} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Credential Details</CardTitle>
            <p className="text-gray-600">
              Enter the connection details for your {getServiceMetadata(serviceType)?.label || serviceType}
            </p>
          </CardHeader>
          <CardContent>
            <DynamicCredentialForm
              serviceType={serviceType}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              serverCredentials={serverCredentials}
            />
            <div className="mt-4">
              <Link href={`/dashboard/projects/${projectId}`}>
                <Button type="button" variant="outline" size="lg" className="w-full">
                  Cancel
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
