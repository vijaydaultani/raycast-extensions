import { Action, ActionPanel, Icon, List, showToast, Toast, Color } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { execSync } from "child_process";

interface Todo {
  id: string;
  name: string;
  notes: string;
  completionDate: string;
  projectName?: string;
  areaName?: string;
  tags: string[];
}

function getCompletedYesterdayTodos(): Todo[] {
  const jxaScript = `
    const Things = Application('Things3');
    const logbook = Things.lists.byName('Logbook');
    const todos = logbook.toDos();

    // Get yesterday's date range
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const result = [];

    for (const todo of todos) {
      const completionDate = todo.completionDate();
      if (completionDate && completionDate >= yesterday && completionDate < today) {
        const project = todo.project();
        const area = todo.area();
        const tagObjects = todo.tags();
        const tags = tagObjects.map(t => t.name());

        result.push({
          id: todo.id(),
          name: todo.name(),
          notes: todo.notes() || '',
          completionDate: completionDate.toISOString(),
          projectName: project ? project.name() : null,
          areaName: area ? area.name() : null,
          tags: tags
        });
      }
    }

    JSON.stringify(result);
  `;

  try {
    const result = execSync(`osascript -l JavaScript -e '${jxaScript.replace(/'/g, "'\\''")}'`, {
      encoding: "utf-8",
      timeout: 30000,
    });
    return JSON.parse(result.trim());
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Application can't be found") || errorMessage.includes("Things3")) {
      throw new Error("Things 3 is not installed or cannot be found");
    }
    if (errorMessage.includes("Not authorized")) {
      throw new Error("Please grant Raycast permission to control Things 3 in System Preferences > Privacy & Security > Automation");
    }
    throw new Error(`Failed to fetch completed todos: ${errorMessage}`);
  }
}

export default function Command() {
  const { data: todos, isLoading, error } = useCachedPromise(
    () => Promise.resolve(getCompletedYesterdayTodos()),
    [],
    {
      onError: (error) => {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to load completed tasks",
          message: error.message,
        });
      },
    }
  );

  if (error) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Failed to load completed tasks"
          description={error.message}
        />
      </List>
    );
  }

  const groupedTodos = todos?.reduce(
    (acc, todo) => {
      const key = todo.projectName || todo.areaName || "No Project";
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(todo);
      return acc;
    },
    {} as Record<string, Todo[]>
  );

  const totalCount = todos?.length || 0;

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Filter completed tasks..."
      navigationTitle={`Completed Yesterday (${totalCount})`}
    >
      {!todos || todos.length === 0 ? (
        <List.EmptyView
          icon={Icon.CheckCircle}
          title="No tasks completed yesterday"
          description="You didn't complete any tasks in Things yesterday"
        />
      ) : (
        Object.entries(groupedTodos || {}).map(([group, groupTodos]) => (
          <List.Section key={group} title={group} subtitle={`${groupTodos.length} task${groupTodos.length > 1 ? "s" : ""}`}>
            {groupTodos.map((todo) => (
              <List.Item
                key={todo.id}
                icon={{ source: Icon.CheckCircle, tintColor: Color.Green }}
                title={todo.name}
                subtitle={todo.notes ? todo.notes.slice(0, 50) + (todo.notes.length > 50 ? "..." : "") : undefined}
                accessories={[
                  ...(todo.tags.length > 0 ? [{ tag: todo.tags[0] }] : []),
                  { text: formatCompletionTime(todo.completionDate) },
                ]}
                actions={
                  <ActionPanel>
                    <Action.OpenInBrowser
                      title="Open in Things"
                      url={`things:///show?id=${todo.id}`}
                      icon={Icon.ArrowRight}
                    />
                    {todo.notes && (
                      <Action.CopyToClipboard
                        title="Copy Notes"
                        content={todo.notes}
                        shortcut={{ modifiers: ["cmd"], key: "n" }}
                      />
                    )}
                    <Action.CopyToClipboard
                      title="Copy Task Name"
                      content={todo.name}
                      shortcut={{ modifiers: ["cmd"], key: "c" }}
                    />
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        ))
      )}
    </List>
  );
}

function formatCompletionTime(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
