import java.io.*;
import java.util.*;

class Ticket {
    String id, name, trainId;
    Ticket(String i, String n, String t) { id = i; name = n; trainId = t; }
}

class Train {
    String id, src, dest, dep;
    int fare, capacity;
    List<Ticket> confirmed = new ArrayList<>();
    Queue<Ticket> waiting = new LinkedList<>();   // FIFO waiting list
}

public class Railway {
    Map<String, List<String>> graph = new HashMap<>();   // stations and routes
    Map<String, Train> trains = new LinkedHashMap<>();
    Map<String, Ticket> tickets = new HashMap<>();       // hashing for ticket lookup
    int counter = 100;

    void addRoute(String a, String b) {
        graph.computeIfAbsent(a, k -> new ArrayList<>()).add(b);
        graph.computeIfAbsent(b, k -> new ArrayList<>()).add(a);
    }

    void viewTrains() {
        for (Train t : trains.values())
            System.out.println(t.id + " " + t.src + "->" + t.dest + " " + t.dep
                + " Rs." + t.fare + " Seats " + t.confirmed.size() + "/" + t.capacity
                + " Waiting " + t.waiting.size());
    }

    // BFS: checks whether a route exists between two stations
    void searchRoute(String from, String to) {
        Set<String> seen = new HashSet<>();
        Queue<String> q = new LinkedList<>();
        q.add(from); seen.add(from);
        while (!q.isEmpty()) {
            String cur = q.poll();
            if (cur.equals(to)) { System.out.println("Route found: " + from + " to " + to); return; }
            for (String nx : graph.getOrDefault(cur, new ArrayList<>()))
                if (seen.add(nx)) q.add(nx);
        }
        System.out.println("No route from " + from + " to " + to);
    }

    void book(String tid, String name) {
        Train t = trains.get(tid);
        if (t == null) { System.out.println("Train " + tid + " not found."); return; }
        Ticket k = new Ticket("TKT" + (++counter), name, tid);
        tickets.put(k.id, k);
        if (t.confirmed.size() < t.capacity) {
            t.confirmed.add(k);
            System.out.println("Ticket booked: " + k.id + " | " + name + " | Train " + tid);
        } else {
            t.waiting.add(k);
            System.out.println("Train full. Passenger added to waiting queue.");
        }
    }

    void cancel(String id) {
        Ticket k = tickets.remove(id);
        if (k == null) { System.out.println("Ticket " + id + " not found."); return; }
        Train t = trains.get(k.trainId);
        if (t.confirmed.remove(k)) {
            System.out.println("Ticket cancelled.");
            Ticket n = t.waiting.poll();               // FIFO transfer
            if (n != null) {
                t.confirmed.add(n);
                System.out.println("Seat allocated to " + n.name + " from waiting queue.");
            }
        } else {
            t.waiting.remove(k);
            System.out.println("Waiting ticket cancelled.");
        }
    }

    void search(String id) {
        Ticket k = tickets.get(id);
        System.out.println(k == null ? "Ticket " + id + " not found."
            : "Found: " + k.id + " | " + k.name + " | Train " + k.trainId);
    }

    void sortByFare() {
        List<Train> l = new ArrayList<>(trains.values());
        l.sort(Comparator.comparingInt(x -> x.fare));
        for (Train x : l) System.out.println(x.id + " " + x.src + "->" + x.dest + " Rs." + x.fare);
    }

    void load() throws IOException {   // railway.txt: id,src,dest,dep,fare,capacity
        try (BufferedReader br = new BufferedReader(new FileReader("railway.txt"))) {
            String s;
            while ((s = br.readLine()) != null) {
                String[] p = s.split(",");
                Train t = new Train();
                t.id = p[0]; t.src = p[1]; t.dest = p[2]; t.dep = p[3];
                t.fare = Integer.parseInt(p[4]); t.capacity = Integer.parseInt(p[5]);
                trains.put(t.id, t); addRoute(t.src, t.dest);
            }
        }
    }

    void save() throws IOException {
        try (PrintWriter pw = new PrintWriter("tickets.txt")) {
            for (Ticket k : tickets.values()) pw.println(k.id + "," + k.name + "," + k.trainId);
        }
    }

    public static void main(String[] args) throws IOException {

    Railway r = new Railway();
    Scanner sc = new Scanner(System.in);

    r.load();

    int choice;

    do {
        System.out.println("\n===== RAILWAY RESERVATION SYSTEM =====");
        System.out.println("1. View All Trains");
        System.out.println("2. Book Ticket");
        System.out.println("3. Search Ticket");
        System.out.println("4. Cancel Ticket");
        System.out.println("5. Search Route");
        System.out.println("6. Sort Trains By Fare");
        System.out.println("7. Exit");

        System.out.print("Enter Your Choice: ");
        choice = sc.nextInt();
        sc.nextLine();

        switch (choice) {

            case 1:
                r.viewTrains();
                break;

            case 2:
                System.out.print("Enter Train ID: ");
                String tid = sc.nextLine();

                System.out.print("Enter Passenger Name: ");
                String name = sc.nextLine();

                r.book(tid, name);
                r.save();
                break;

            case 3:
                System.out.print("Enter Ticket ID: ");
                String sid = sc.nextLine();

                r.search(sid);
                break;

            case 4:
                System.out.print("Enter Ticket ID: ");
                String cid = sc.nextLine();

                r.cancel(cid);
                r.save();
                break;

            case 5:
                System.out.print("Enter Source: ");
                String from = sc.nextLine();

                System.out.print("Enter Destination: ");
                String to = sc.nextLine();

                r.searchRoute(from, to);
                break;

            case 6:
                r.sortByFare();
                break;

            case 7:
                r.save();
                System.out.println("Thank You! Exiting...");
                break;

            default:
                System.out.println("Invalid Choice! Try Again.");
        }

    } while (choice != 7);

    sc.close();
}
}