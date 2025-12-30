import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      richColors
      expand={true}
      duration={4000}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:shadow-primary/20",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:bg-green-950 group-[.toaster]:border-green-800 group-[.toaster]:text-green-100",
          error: "group-[.toaster]:bg-red-950 group-[.toaster]:border-red-800 group-[.toaster]:text-red-100",
          info: "group-[.toaster]:bg-blue-950 group-[.toaster]:border-blue-800 group-[.toaster]:text-blue-100",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
