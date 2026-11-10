// Creating a task, shared by /api/items and sorting from the Brain Dump.

import type { Item, ItemBox, ItemCategory } from "@/api/client";
import { isLocalMode, localStore } from "@/lib/local";
import { loadLocalTasks, saveLocalTasks } from "@/lib/localTasks";
import { createClient } from "@/lib/supabase/server";

export const createTask = async (
  userId: string,
  { title, category, box, notes }: { title: string; category: ItemCategory; box: ItemBox | null; notes: string | null }
): Promise<Item> => {
  if (isLocalMode) {
    await loadLocalTasks();
    const item: Item = {
      id: crypto.randomUUID(),
      title,
      category,
      done: false,
      status: "not_started",
      box,
      notes,
      scheduled_on: null,
      scheduled_time: null,
      provider_id: null,
      created_at: new Date().toISOString(),
      completed_at: null,
      sort_order: Math.max(0, ...localStore.items.map((i) => i.sort_order)) + 1,
    };
    localStore.items.push(item);
    await saveLocalTasks();
    return item;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .insert({ user_id: userId, title, category, box, notes })
    .select("*")
    .single();
  if (error) throw error;
  return data as Item;
};

// Takes a deleted service provider off every task it was assigned to. In Supabase the
// foreign key does this too (on delete set null); this keeps local mode the same.
export const unassignProvider = async (userId: string, providerId: string) => {
  if (isLocalMode) {
    await loadLocalTasks();
    const assigned = localStore.items.filter((i) => i.provider_id === providerId);
    if (assigned.length === 0) return;
    for (const item of assigned) item.provider_id = null;
    await saveLocalTasks();
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("items")
    .update({ provider_id: null })
    .eq("provider_id", providerId)
    .eq("user_id", userId);
  if (error) throw error;
};

export const deleteTask = async (userId: string, id: string) => {
  if (isLocalMode) {
    await loadLocalTasks();
    localStore.items = localStore.items.filter((i) => i.id !== id);
    await saveLocalTasks();
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("items").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
};
