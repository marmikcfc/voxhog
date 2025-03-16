import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import Link from "next/link";

interface LoginFormProps {
    onLogin: (username: string, password: string) => Promise<void>;
    isLoading: boolean;
}

export function LoginForm({ onLogin, isLoading }: LoginFormProps) {
    const form = useForm({
        defaultValues: {
            username: "",
            password: "",
        },
    });

    const onSubmit = async (values: { username: string; password: string }) => {
        try {
            await onLogin(values.username, values.password);
        } catch (error) {
            toast.error("An error occurred during login");
        }
    };

    return (
        <div className="mx-auto w-full max-w-md space-y-6">
            <div className="space-y-2 text-center">
                <h1 className="text-3xl font-bold">Welcome Back</h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Enter your credentials to access your account
                </p>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Username</FormLabel>
                                <FormControl>
                                    <Input placeholder="Enter your username" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                    <Input
                                        type="password"
                                        placeholder="Enter your password"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? "Logging in..." : "Login"}
                    </Button>
                </form>
            </Form>
            <div className="text-center text-sm">
                Don't have an account?{" "}
                <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
                    Create an account
                </Link>
            </div>
        </div>
    );
} 