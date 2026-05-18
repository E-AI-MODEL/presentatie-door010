import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Send, 
  User, 
  X,
  MessageCircle,
  Clock,
  GraduationCap,
  Loader2,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ProfileWithEmail } from "./UserOverviewTable";

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface AdvisorChatPanelProps {
  selectedUser: ProfileWithEmail | null;
  onClose: () => void;
}

export function AdvisorChatPanel({ selectedUser, onClose }: AdvisorChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load real messages when user is selected
  useEffect(() => {
    if (selectedUser) {
      loadConversation(selectedUser.user_id);
    } else {
      setMessages([]);
      setConversationId(null);
    }
  }, [selectedUser]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`advisor-chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadConversation = async (userId: string) => {
    setLoadingMessages(true);
    try {
      const { data: conversations, error: convError } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (convError) throw convError;

      if (!conversations || conversations.length === 0) {
        setMessages([]);
        setConversationId(null);
        setLoadingMessages(false);
        return;
      }

      const convId = conversations[0].id;
      setConversationId(convId);

      const { data: messagesData, error: msgError } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (msgError) throw msgError;
      setMessages(messagesData || []);
    } catch (err) {
      console.error("Error loading conversation:", err);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversationId) return;
    setDeleting(true);
    try {
      // Delete messages first (FK constraint)
      const { error: msgErr } = await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", conversationId);
      if (msgErr) throw msgErr;

      // Delete conversation
      const { error: convErr } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId);
      if (convErr) throw convErr;

      setMessages([]);
      setConversationId(null);
      toast.success("Gesprek gewist");
    } catch (err) {
      console.error("Error deleting conversation:", err);
      toast.error("Kon gesprek niet wissen");
    } finally {
      setDeleting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;

    setSending(true);
    try {
      let targetConvId = conversationId;

      if (!targetConvId) {
        const { data: newConv, error: convError } = await supabase
          .from("conversations")
          .insert({ user_id: selectedUser.user_id, title: "Gesprek met adviseur" })
          .select("id")
          .single();

        if (convError) throw convError;
        targetConvId = newConv.id;
        setConversationId(targetConvId);
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: advisorProfile } = authUser ? await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", authUser.id)
        .single() : { data: null };

      const advisorName = advisorProfile?.first_name
        ? `${advisorProfile.first_name}${advisorProfile.last_name ? ' ' + advisorProfile.last_name : ''}`
        : 'Adviseur';

      const { data: insertedMsg, error: msgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: targetConvId,
          role: "advisor",
          content: newMessage,
          metadata: { advisor_name: advisorName },
        })
        .select("id, role, content, created_at")
        .single();

      if (msgError) throw msgError;

      setMessages(prev => [...prev, insertedMsg]);
      setNewMessage("");
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  if (!selectedUser) {
    return (
      <Card className="h-full flex items-center justify-center bg-muted/20">
        <div className="text-center p-8">
          <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium text-foreground mb-2">Selecteer een kandidaat</h3>
          <p className="text-sm text-muted-foreground">
            Klik op een kandidaat in de lijst om het gesprek te bekijken en berichten te sturen.
          </p>
        </div>
      </Card>
    );
  }

  const phaseLabels: Record<string, string> = {
    interesseren: 'Interesseren',
    orienteren: 'Oriënteren',
    beslissen: 'Beslissen',
    matchen: 'Matchen',
    voorbereiden: 'Voorbereiden',
  };

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <CardHeader className="border-b border-border pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-full p-2">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">
                {selectedUser.first_name && selectedUser.last_name 
                  ? `${selectedUser.first_name} ${selectedUser.last_name}`
                  : selectedUser.email || 'Onbekende gebruiker'}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {selectedUser.current_phase && (
                  <Badge variant="outline" className="text-xs">
                    <GraduationCap className="h-3 w-3 mr-1" />
                    {phaseLabels[selectedUser.current_phase] || selectedUser.current_phase}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Lid sinds {format(new Date(selectedUser.created_at), 'd MMM yyyy', { locale: nl })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {conversationId && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={deleting} title="Gesprek wissen">
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Gesprek wissen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Alle berichten in dit gesprek worden permanent verwijderd. Dit kan niet ongedaan worden gemaakt.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConversation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Wis gesprek
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-[400px] p-4" ref={scrollRef}>
          <div className="space-y-4">
            {loadingMessages ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Berichten laden...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nog geen berichten met deze kandidaat.</p>
                <p className="text-sm mt-1">Start het gesprek door een bericht te sturen.</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'advisor' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'advisor'
                        ? 'bg-primary text-primary-foreground'
                        : message.role === 'assistant'
                        ? 'bg-accent/10 text-foreground border border-accent/20'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <p className="text-xs text-accent font-medium mb-1">DOORai</p>
                    )}
                    {message.role === 'advisor' && (
                      <p className="text-xs text-primary-foreground/70 font-medium mb-1">Adviseur</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.role === 'advisor' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}>
                      {format(new Date(message.created_at), 'HH:mm', { locale: nl })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Input */}
      <div className="border-t border-border p-4">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex gap-2"
        >
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Typ een bericht naar de kandidaat..."
            disabled={sending}
            className="flex-1"
          />
          <Button type="submit" disabled={sending || !newMessage.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          💡 Dit bericht wordt direct zichtbaar voor de kandidaat in hun DOORai chat.
        </p>
      </div>
    </Card>
  );
}
