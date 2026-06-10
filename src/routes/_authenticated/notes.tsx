import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  BookHeart,
  ImagePlus,
  LogOut,
  Plus,
  Search,
  Trash2,
  X,
  Check,
  Save,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({
    meta: [
      { title: "Your notes — Paper" },
      { name: "description", content: "Your warm little notebook." },
    ],
  }),
  component: NotesPage,
});

type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  image_paths: string[];
  created_at: string;
  updated_at: string;
};

const NOTES_KEY = ["notes"] as const;

async function fetchNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as Note[];
}

async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from("note-images")
    .createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}

function NotesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: NOTES_KEY,
    queryFn: fetchNotes,
  });

  useEffect(() => {
    if (!selectedId && notes.length > 0) setSelectedId(notes[0].id);
  }, [notes, selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
    );
  }, [notes, search]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  const createNote = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("notes")
        .insert({ user_id: u.user.id, title: "", content: "" })
        .select()
        .single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: (note) => {
      qc.setQueryData<Note[]>(NOTES_KEY, (prev) => [note, ...(prev ?? [])]);
      setSelectedId(note.id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create note"),
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="md:w-80 md:border-r border-border bg-sidebar flex flex-col md:h-screen">
        <div className="p-5 border-b border-sidebar-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-accent/40 flex items-center justify-center">
              <BookHeart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-serif text-xl leading-none text-foreground">Paper</h1>
              <p className="text-xs text-muted-foreground mt-0.5">your notebook</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            title="Sign out"
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-3 space-y-2">
          <Button
            onClick={() => createNote.mutate()}
            disabled={createNote.isPending}
            className="w-full justify-start"
          >
            <Plus className="w-4 h-4 mr-2" />
            New note
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground px-3 py-6 text-center">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground px-3 py-6 text-center">
              {notes.length === 0 ? "No notes yet. Click 'New note'." : "No matches."}
            </p>
          ) : (
            filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                className={`w-full text-left rounded-lg px-3 py-3 transition border ${
                  selectedId === n.id
                    ? "bg-card border-accent/60 shadow-paper"
                    : "border-transparent hover:bg-sidebar-accent"
                }`}
              >
                <div className="font-serif text-base truncate text-foreground">
                  {n.title.trim() || "Untitled"}
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {n.content.trim() || "Empty note"}
                </div>
                <div className="text-[11px] text-muted-foreground/80 mt-1.5">
                  {formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}
                  {n.image_paths.length > 0 && ` · ${n.image_paths.length} image${n.image_paths.length > 1 ? "s" : ""}`}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Editor */}
      <main className="flex-1 min-h-screen md:h-screen overflow-y-auto">
        {selected ? (
          <NoteEditor key={selected.id} note={selected} />
        ) : (
          <div className="h-full min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
            <BookHeart className="w-12 h-12 text-accent mb-4" />
            <h2 className="font-serif text-2xl text-foreground">A blank page awaits.</h2>
            <p className="text-muted-foreground mt-2">Create your first note to get started.</p>
            <Button onClick={() => createNote.mutate()} className="mt-6">
              <Plus className="w-4 h-4 mr-2" /> New note
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

function NoteEditor({ note }: { note: Note }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [paths, setPaths] = useState<string[]>(note.image_paths);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const dirty =
    title !== note.title ||
    content !== note.content ||
    JSON.stringify(paths) !== JSON.stringify(note.image_paths);

  const { data: urlMap = {} } = useQuery({
    queryKey: ["note-image-urls", note.id, paths.join("|")],
    queryFn: () => signedUrls(paths),
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .update({ title, content, image_paths: paths })
        .eq("id", note.id)
        .select()
        .single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: (updated) => {
      qc.setQueryData<Note[]>(NOTES_KEY, (prev) =>
        (prev ?? [])
          .map((n) => (n.id === updated.id ? updated : n))
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
      );
      toast.success("Saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (paths.length > 0) {
        await supabase.storage.from("note-images").remove(paths);
      }
      const { error } = await supabase.from("notes").delete().eq("id", note.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.setQueryData<Note[]>(NOTES_KEY, (prev) =>
        (prev ?? []).filter((n) => n.id !== note.id),
      );
      toast.success("Note deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const newPaths: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${u.user.id}/${note.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("note-images")
          .upload(path, file, { contentType: file.type });
        if (error) throw error;
        newPaths.push(path);
      }
      setPaths((prev) => [...prev, ...newPaths]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeImage(path: string) {
    setPaths((prev) => prev.filter((p) => p !== path));
    await supabase.storage.from("note-images").remove([path]).catch(() => {});
  }

  return (
    <div className="max-w-3xl mx-auto px-6 md:px-10 py-8 md:py-12">
      <div className="flex items-center justify-between mb-6 gap-2">
        <p className="text-xs text-muted-foreground">
          Last edited {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
          {dirty && <span className="ml-2 text-accent-foreground/70">· unsaved changes</span>}
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
          >
            <ImagePlus className="w-4 h-4 mr-1.5" />
            {uploading ? "Uploading…" : "Add image"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4 mr-1.5" /> Delete
          </Button>
          <Button
            size="sm"
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
          >
            {save.isPending ? (
              "Saving…"
            ) : dirty ? (
              <>
                <Save className="w-4 h-4 mr-1.5" /> Save
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-1.5" /> Saved
              </>
            )}
          </Button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled"
        className="w-full bg-transparent border-0 outline-none font-serif text-4xl md:text-5xl text-foreground placeholder:text-muted-foreground/50 mb-4"
      />

      {paths.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {paths.map((p) => (
            <div
              key={p}
              className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted shadow-paper"
            >
              {urlMap[p] ? (
                <img
                  src={urlMap[p]}
                  alt="Note attachment"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full animate-pulse bg-muted" />
              )}
              <button
                type="button"
                onClick={() => removeImage(p)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/90 text-foreground opacity-0 group-hover:opacity-100 transition flex items-center justify-center shadow-paper"
                title="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Start writing…"
        className="min-h-[60vh] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/60"
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the note and any attached images.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => del.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
