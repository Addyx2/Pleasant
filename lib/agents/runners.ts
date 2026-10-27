import { prisma } from "@/lib/db";

/**
 * Dispatches a new task to the Runners queue.
 * This acts as the background job queue for the platform.
 */
export async function dispatchRunnerTask(agencyId: string, title: string, payload: unknown) {
  const task = await prisma.agentTask.create({
    data: {
      agencyId,
      agentType: "RUNNERS",
      title,
      payload: JSON.stringify(payload),
      status: "PENDING",
    },
  });

  // Log the dispatch
  await prisma.agentLog.create({
    data: {
      agencyId,
      agentName: "RUNNERS",
      action: "TASK_DISPATCHED",
      details: `Task '${title}' queued for execution.`,
      status: "SUCCESS",
    }
  });

  return task;
}

/**
 * Processes pending tasks in the queue.
 * In production, this would run via a cron job, worker dyno, or trigger on insert.
 */
export async function processRunnerTasks() {
  // Fetch up to 10 pending tasks
  const pendingTasks = await prisma.agentTask.findMany({
    where: {
      agentType: "RUNNERS",
      status: "PENDING",
    },
    take: 10,
    orderBy: { createdAt: "asc" },
  });

  if (pendingTasks.length === 0) return 0;

  for (const task of pendingTasks) {
    // 1. Mark as RUNNING
    await prisma.agentTask.update({
      where: { id: task.id },
      data: { status: "RUNNING" },
    });

    try {
      // 2. Execute Task Logic Based on Title
      // Mock execution delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (task.title === "SYNC_WFM_ROSTER") {
        // Logic to sync with external HRIS (Workday, Deputy)
      } else if (task.title === "GENERATE_INVOICES") {
        // Logic to generate billing
      } else {
        // Generic task handler
      }

      // 3. Mark as COMPLETED
      await prisma.agentTask.update({
        where: { id: task.id },
        data: { status: "COMPLETED" },
      });

      // 4. Log completion
      await prisma.agentLog.create({
        data: {
          agencyId: task.agencyId,
          agentName: "RUNNERS",
          action: "TASK_COMPLETED",
          details: `Task '${task.title}' executed successfully.`,
          status: "SUCCESS",
        }
      });

    } catch (error: unknown) {
      // Handle failure
      await prisma.agentTask.update({
        where: { id: task.id },
        data: { status: "FAILED", payload: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }) },
      });
      
      await prisma.agentLog.create({
        data: {
          agencyId: task.agencyId,
          agentName: "RUNNERS",
          action: "TASK_FAILED",
          details: `Task '${task.title}' failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: "ERROR",
        }
      });
    }
  }

  return pendingTasks.length;
}
