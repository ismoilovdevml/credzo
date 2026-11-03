"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DynamicCredentialForm } from "@/components/DynamicCredentialForm";
import { getServiceMetadata } from "@/lib/services";
import type { ServiceType, Credential } from "@/lib/types";

export default function EditCredentialPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const credentialId = params.credentialId as string;

  const [credential, setCredential] = useState<Credential | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverCredentials, setServerCredentials] = useState<Credential[]>([]);

  // Load credential and servers
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            // Find the credential to edit
            const cred = data.data.credentials.find((c: Credential) => c.id === credentialId);
            if (!cred) {
              router.push(`/dashboard/projects/${projectId}`);
              return;
            }
            setCredential(cred);

            // Load server credentials (excluding the current one if it's a server)
            const servers = data.data.credentials.filter(
              (c: Credential) => ["vm-server", "ssh-server", "ftp", "sftp"].includes(c.type) && c.id !== credentialId
            );
            setServerCredentials(servers);
          }
        } else {
          router.push(`/dashboard/projects/${projectId}`);
        }
      } catch (error) {
        console.error("Failed to load credential:", error);
        router.push(`/dashboard/projects/${projectId}`);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projectId, credentialId, router]);

  const handleSubmit = async (formData: any) => {
    if (!credential) return;

    setIsSubmitting(true);

    try {
      // Prepare credential data
      const { name, description, linkedServers, ...fields } = formData;

      // Convert string numbers to actual numbers where appropriate
      const processedFields: Record<string, any> = {};
      const serviceMetadata = getServiceMetadata(credential.type);

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

      const updates = {
        name,
        description: description || "",
        fields: processedFields,
        linkedServers: linkedServers || [],
      };

      const response = await fetch(`/api/credentials/${credentialId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (result.success) {
        router.push(`/dashboard/projects/${projectId}`);
      } else {
        console.error("Failed to update credential:", result.error);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Failed to update credential:", error);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading credential...</p>
        </div>
      </div>
    );
  }

  if (!credential) {
    return null;
  }

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
        <h1 className="text-4xl font-black text-gray-900 mb-2">Edit Credential</h1>
        <p className="text-gray-600">Update the details for {credential.name}</p>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Credential Details</CardTitle>
            <p className="text-gray-600">
              Editing {getServiceMetadata(credential.type)?.label || credential.type}
            </p>
          </CardHeader>
          <CardContent>
            <DynamicCredentialForm
              serviceType={credential.type}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              serverCredentials={serverCredentials}
              initialData={{
                name: credential.name,
                description: credential.description,
                ...credential.fields,
              }}
              initialLinkedServers={credential.linkedServers || []}
              isEditMode={true}
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
